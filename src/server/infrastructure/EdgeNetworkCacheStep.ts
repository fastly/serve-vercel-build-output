import { ObjectStore } from "fastly:object-store";

import { RequestContext } from "../server/types.js";
import FunctionAsset from "../assets/FunctionAsset.js";
import StaticAsset from "../assets/StaticAsset.js";
import { getLogger, ILogger } from "../logging/index.js";
import FunctionsStep from "./FunctionsStep.js";
import VercelBuildOutputServer from "../server/VercelBuildOutputServer.js";
import { encodeKvSegment, encodeQueryForKv } from "../utils/kv.js";

import type { HttpHeaders, RouteMatcherContext } from "../types/routing.js";

export type EdgeNetworkCacheStepInit = {
  vercelBuildOutputServer: VercelBuildOutputServer,
};

export default class EdgeNetworkCacheStep {
  private _vercelBuildOutputServer: VercelBuildOutputServer;
  private _functionsStep: FunctionsStep;

  private _logger: ILogger;

  constructor(init: EdgeNetworkCacheStepInit) {
    const {
      vercelBuildOutputServer,
    } = init;
    this._vercelBuildOutputServer = vercelBuildOutputServer;
    this._functionsStep = new FunctionsStep({
      vercelBuildOutputServer,
    });

    this._logger = getLogger(this.constructor.name);
  }

  async doStep(
    requestContext: RequestContext,
    routeMatcherContext: RouteMatcherContext,
    overrideDest?: string,
  ) {

    const { pathname } = routeMatcherContext;
    this._logger.debug('Serving from filesystem', { pathname });

    const asset = this._vercelBuildOutputServer.assetsCollection.getAsset(pathname);

    if (asset instanceof StaticAsset) {
      return await this.serveStaticAsset(
        asset,
      );
    }
    if (asset instanceof FunctionAsset) {
      return await this.serveFunctionAsset(
        asset,
        requestContext,
        routeMatcherContext,
        overrideDest,
      );
    }

    if (asset == null) {
      throw new Error(`Unknown asset: ${pathname}`);
    }
    throw new Error('Unknown asset type ' + pathname);
  }

  async serveStaticAsset(
    asset: StaticAsset,
  ) {
    // Static items are always "cached"
    // They are served from KV (if enabled) or from inline (at the edge)
    const storeEntry = await asset.contentAsset.getStoreEntry();
    return new Response(storeEntry.body, {
      status: 200,
      headers: {
        'Content-Type': asset.contentType,
      },
    });
  }

  async serveFunctionAsset(
    asset: FunctionAsset,
    requestContext: RequestContext,
    routeMatcherContext: RouteMatcherContext,
    overrideDest?: string,
  ) {

    const now = Date.now();

    let kvStore: ObjectStore | undefined = undefined;
    if (this._vercelBuildOutputServer.serverConfig.cachingKvStore != null) {
      kvStore = new ObjectStore(
        this._vercelBuildOutputServer.serverConfig.cachingKvStore
      );
    }

    const entryId =
      `${requestContext.serviceId}:${encodeKvSegment(routeMatcherContext.pathname)}:` +
      encodeQueryForKv(routeMatcherContext.query, asset.prerenderConfig?.allowQuery);
    const cacheEntryKey =
      `e${entryId}`;
    const metadataEntryKey =
      `m${entryId}`;

    const doRequest = async () => {

      this._logger.debug(`doing fetch on ${routeMatcherContext.pathname}`);

      let response = await this._functionsStep.doStep(requestContext, routeMatcherContext, overrideDest);

      if (kvStore != null) {

        let body: string | null = null;
        if (response.body != null) {

          // this._logger.debug('teeing');
          // let body2: ReadableStream<Uint8Array>;
          // const [ body, body2 ] = response.body.tee();

          // Read entire response.
          // Hopefully this is enough RAM.
          body = await response.text();
          response = new Response(body, {
            status: response.status,
            headers: response.headers,
          });

        }

        const responseMeta = {
          status: response.status,
          headers: response.headers,
          createTimeMs: now,
        };

        this._logger.debug(`Writing ${metadataEntryKey}`, responseMeta);

        // await Promise.all([
        await kvStore.put(metadataEntryKey, JSON.stringify(responseMeta));

        if (body != null) {
          this._logger.debug(`Writing ${cacheEntryKey}`);
          await kvStore.put(cacheEntryKey, body);
        }
        // ]);
      }

      this._logger.debug(`returning fetch result`);

      return response;

    };

    // Is this a prerender function?
    if (asset.prerenderConfig != null) {

      // Prerender Group Key
      const groupKey = asset.prerenderConfig?.group != null ?
        `g${requestContext.serviceId}:${asset.prerenderConfig.group}` :
        undefined;

      // Revalidate mode
      // Only do revalidate mode if the header exists AND matches
      // the value for the function.
      const validationHeader =
        requestContext.request.headers.get('x-prerender-revalidate');
      if (
        validationHeader != null && (
          asset.prerenderConfig?.bypassToken == null ||
          validationHeader.trim() === asset.prerenderConfig?.bypassToken.trim()
        )
      ) {

        if (kvStore != null) {

          const promises: Promise<unknown>[] = [];

          // Write group revalidate time to KV
          if (groupKey != null) {
            const groupEntry = {
              refreshTimeMs: now,
            };
            promises.push(kvStore.put(groupKey, JSON.stringify(groupEntry)));
          }

          // Request updated item and save to KV
          promises.push(doRequest());

          // do these in background
          requestContext.edgeFunctionContext
            .waitUntil(Promise.all(promises));
        }
        this._logger.debug('x-vercel-cache: REVALIDATED');
        return new Response(
          null,
          {
            headers: {
              'x-vercel-cache': 'REVALIDATED',
            },
          }
        );
      }

      // Check for item in KV
      if (kvStore != null) {

        const cachedEntry = await this.getCachedEntry(
          kvStore,
          now,
          asset.prerenderConfig.expiration,
          groupKey,
          metadataEntryKey,
          cacheEntryKey,
        );

        if (cachedEntry != null) {
          // STALE if expired, HIT if hit
          let cacheHeader = 'HIT';
          if (cachedEntry.expired) {
            cacheHeader = 'STALE';
            // Request updated item in background and save to cache
            requestContext.edgeFunctionContext.waitUntil(
              doRequest()
            );
          }

          this._logger.debug(`x-vercel-cache: ${cacheHeader}`);

          return new Response(
            cachedEntry.entry,
            {
              status: cachedEntry.status,
              headers: {
                ...cachedEntry.headers,
                'x-vercel-cache': cacheHeader,
              },
            }
          );
        }
      }

      // Either the cache is not active, or the item was not in the cache,
      // so check if there is a prerender ('fallback') version
      if (asset.prerenderConfig.fallback != null) {

        const fallbackAsset = this._vercelBuildOutputServer.contentAssets.getAsset(asset.prerenderConfig.fallback);
        if (fallbackAsset != null) {

          if (kvStore != null) {
            // Request updated item in background and save to cache
            requestContext.edgeFunctionContext.waitUntil(
              doRequest()
            );
          }

          const storeEntry = await fallbackAsset.getStoreEntry();
          this._logger.debug(`x-vercel-cache: PRERENDER`);
          return new Response(storeEntry.body, {
            status: 200,
            headers: {
              'Content-Type': fallbackAsset.getMetadata().contentType,
              'x-vercel-cache': 'PRERENDER',
            },
          });
        }
      }
    }

    // If we are here, then the item was not found in the cache and there was no
    // prerender version.

    this._logger.debug(`x-vercel-cache: MISS`);

    // serve it normally and save the result to cache
    return await doRequest();
  }

  async getCachedEntry(
    kvStore: ObjectStore,
    now: number,
    expiration: number | false,
    groupKey: string | undefined,
    metadataEntryKey: string,
    cacheEntryKey: string,
  ) {

    // TODO: replace this separate lookup of metadata entry with HEAD request to API

    const [ groupEntry, metadataEntry, cacheEntry ] = await Promise.all([
      groupKey != null ? kvStore.get(groupKey) : null,
      kvStore.get(metadataEntryKey),
      kvStore.get(cacheEntryKey)
    ]);

    if (metadataEntry == null) {
      return null;
    }

    const metadata = (await metadataEntry.json()) as any;

    const status = (metadata.status ?? {}) as number;
    const headers = (metadata.headers ?? {}) as HttpHeaders;

    const createTimeMs = metadata.createTimeMs ?? 0;

    let groupRefreshTimeMs = 0;
    if (groupEntry != null) {
      const groupValue = (await groupEntry.json()) as any;
      groupRefreshTimeMs = groupValue.refreshTimeMs ?? 0;
    }

    let expired = false;
    if (
      (expiration !== false && now > createTimeMs + expiration * 1000) ||
      groupRefreshTimeMs > createTimeMs
    ) {
      expired = true;
    }

    return {
      expired,
      status,
      headers,
      entry: cacheEntry?.body,
    };
  }
}

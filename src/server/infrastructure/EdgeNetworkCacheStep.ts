import { env } from "fastly:env";
import { KVStore } from "fastly:kv-store";

import { CACHING_KVSTORE_LOCAL, PRERENDER_REVALIDATE_HEADER } from '../constants.js';
import { RequestContext } from "../server/types.js";
import FunctionAsset from "../assets/FunctionAsset.js";
import StaticAsset from "../assets/StaticAsset.js";
import { getLogger, ILogger } from "../logging/index.js";
import FunctionsStep from "./FunctionsStep.js";
import { routeMatcherContextToRequest } from "../routing/RouteMatcherContext.js";
import VercelBuildOutputServer from "../server/VercelBuildOutputServer.js";
import { encodeKvSegment, encodeQueryForKv } from "../utils/kv.js";
import { parseCacheControl } from "../utils/cacheControl.js";
import { formatQueryString } from "../utils/query.js";
import { readableStreamToArray } from "../utils/stream.js";

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
    routeMatches?: string,
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
        routeMatches,
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
    routeMatches?: string,
  ) {

    const now = Date.now();

    const kvStoreName = env('FASTLY_HOSTNAME') !== 'localhost' ?
      this._vercelBuildOutputServer.serverConfig.cachingKvStore :
      CACHING_KVSTORE_LOCAL;

    let kvStore: KVStore | undefined = undefined;
    if (kvStoreName != null) {
      kvStore = new KVStore(kvStoreName);
    }

    const entryId =
      `${requestContext.serviceId}:${encodeKvSegment(routeMatcherContext.pathname)}:` +
      encodeQueryForKv(routeMatcherContext.query, asset.prerenderConfig?.allowQuery);
    const cacheEntryKey =
      `e${entryId}`;
    const metadataEntryKey =
      `m${entryId}`;

    const doFunctionStep = async(returnResponse: boolean = false) => {
      this._logger.debug(`Doing functions step: ${routeMatcherContext.pathname}`);

      const request = routeMatcherContextToRequest(
        routeMatcherContext,
        overrideDest,
      );
      if (routeMatches != null) {
        // Emulate Vercel's behavior of setting this header
        request.headers.set('x-now-route-matches', routeMatches);
      }
      request.headers.set('x-matched-path', routeMatcherContext.pathname + (formatQueryString(routeMatcherContext.query) ?? ''));

      this._logger.debug(`request.url: ${request.url}`);
      this._logger.debug('Request headers');
      for (const [key, value] of request.headers.entries()) {
        this._logger.debug(`${key}: ${value}`);
      }

      const response = await this._functionsStep.doStep(requestContext, request);

      this._logger.debug('Response headers');
      for (const [key, value] of response.headers.entries()) {
        this._logger.debug(`${key}: ${value}`);
      }

      if (
        routeMatcherContext.method !== 'GET' && routeMatcherContext.method !== 'HEAD'
      ) {
        this._logger.debug(`Not a GET or HEAD request, returning without caching.`);
        return response;
      }

      if (kvStore == null) {
        this._logger.debug(`KV not enabled, returning without caching.`);
        return response;
      }

      const headers: HttpHeaders = {};
      for (const [key, value] of response.headers.entries()) {
        headers[key.toLowerCase()] = value;
      }

      const cacheControlValue = parseCacheControl(headers['cache-control']);
      this._logger.debug('cache control value', cacheControlValue);

      // Only cache things if they are marked as public responses
      if (!cacheControlValue?.isPublic) {
        this._logger.debug(`Cache control value not public, returning without caching.`);
        return response;
      }

      let responseToReturn: Response | null;

      // TODO: One day when response.clone() is implemented, use it
      // response.body.tee doesn't seem to work well either =(
      const array = response.body != null ? await readableStreamToArray(response.body) : null;

      // TODO: It seems that KVStore.prototype.put() doesn't seem to work with
      // user-provided ReadableStream, so we serialize it first
      let cacheSaveBody: BodyInit | null = array;


      // If returnResponse is false, then we don't need to return the
      // response to the caller, so we don't bother cloning it
      if (returnResponse) {
        responseToReturn = new Response(
          array,
          {
            status: response.status,
            headers: response.headers,
          }
        );
      } else {
        responseToReturn = {} as Response;
      }

      const status = response.status;
      const responseMeta = {
        status,
        headers,
        createTimeMs: now,
        ...cacheControlValue,
      };

      // this._logger.debug(`Writing 1 ${metadataEntryKey}`, responseMeta);
      await kvStore.put(metadataEntryKey, JSON.stringify(responseMeta));
      // this._logger.debug(`Wrote 1 ${metadataEntryKey}`);

      if (cacheSaveBody != null) {
        // this._logger.debug(`Writing 2 ${cacheEntryKey}`);
        await kvStore.put(cacheEntryKey, cacheSaveBody);
        // this._logger.debug(`Wrote 2 ${cacheEntryKey}`);
      }

      this._logger.debug(`returning fetch result`);

      return responseToReturn;
    };

    let groupKey: string | undefined = undefined;
    let expiration: number | false = false;
    let fallback: string | undefined = undefined;

    // Is this a prerender function?
    if (asset.prerenderConfig != null) {

      // Prerender Group Key
      groupKey = asset.prerenderConfig?.group != null ?
        `g${requestContext.serviceId}:${asset.prerenderConfig.group}` :
        undefined;

      // expiration
      expiration = asset.prerenderConfig.expiration;

      // fallback
      fallback = asset.prerenderConfig.fallback;

      // Revalidate mode
      // Only do revalidate mode if the header exists AND matches
      // the value for the function.
      const validationHeader =
        requestContext.request.headers.get(PRERENDER_REVALIDATE_HEADER);
      if (
        validationHeader != null && (
          asset.prerenderConfig?.bypassToken == null ||
          validationHeader.trim() === asset.prerenderConfig?.bypassToken.trim()
        )
      ) {
        if (kvStore != null) {
          // Write group revalidate time to KV
          if (groupKey != null) {
            const groupEntry = {
              refreshTimeMs: now,
            };
            const p = (async() => {
              // this._logger.debug(`Writing 3 ${groupKey}`, groupEntry);
              await kvStore.put(groupKey, JSON.stringify(groupEntry));
              // this._logger.debug(`Wrote 3 ${groupKey}`);
            })();
            requestContext.edgeFunctionContext.waitUntil(p);
          }

          // Request updated item and save to KV
          // NOTE: This doesn't seem to work at the moment, for some reason.
          requestContext.edgeFunctionContext
            .waitUntil(doFunctionStep());
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
    }

    // Check for item in KV
    if (kvStore != null) {

      const cachedEntry = await this.getCachedEntry(
        kvStore,
        now,
        expiration,
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
            doFunctionStep()
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
    if (fallback != null) {

      const fallbackAsset = this._vercelBuildOutputServer.contentAssets.getAsset(fallback);
      if (fallbackAsset != null) {

        if (kvStore != null) {
          // NOTE: https://vercel.com/docs/build-output-api/v3/primitives#fallback-static-file
          // > When the fallback file is served, the Serverless Function will also be invoked "out-of-band" to re-generate
          // > a new version of the asset that will be cached and served for future HTTP requests.
          requestContext.edgeFunctionContext.waitUntil(
            doFunctionStep()
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

    // If we are here, then the item was not found in the cache and there was no
    // prerender version.

    this._logger.debug(`x-vercel-cache: MISS`);

    // serve it normally and save the result to cache
    return await doFunctionStep(true);
  }

  async getCachedEntry(
    kvStore: KVStore,
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

    // s-maxage
    const sMaxAge = metadata.sMaxAge as number | undefined;
    const expirationSeconds = sMaxAge ?? expiration;

    const createTimeMs = metadata.createTimeMs ?? 0;

    let groupRefreshTimeMs = 0;
    if (groupEntry != null) {
      const groupValue = (await groupEntry.json()) as any;
      groupRefreshTimeMs = groupValue.refreshTimeMs ?? 0;
    }

    let expired = false;
    if (
      (expirationSeconds !== false && now > createTimeMs + expirationSeconds * 1000) ||
      groupRefreshTimeMs > createTimeMs
    ) {
      expired = true;
    }

    // stale-while-revalidate
    if (expired) {
      const staleWhileRevalidateValue = metadata.staleWhileRevalidate as number | undefined;
      if (
        staleWhileRevalidateValue == null ||
        (
          staleWhileRevalidateValue != 0 &&
          now > createTimeMs + staleWhileRevalidateValue * 1000
        )
      ) {
        // if this is older than state-while-revalidate limit, then it's considered to not even
        // be in the cache.
        return null;
      }
    }

    return {
      expired,
      status,
      headers,
      entry: cacheEntry?.body,
    };
  }
}

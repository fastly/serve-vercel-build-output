import { env } from "fastly:env";

import { ContentAssets, ModuleAssets } from "@fastly/compute-js-static-publish";

import VercelBuildOutputTemplateEngine from "../templating/VercelBuildOutputTemplateEngine.js";
import AssetsCollection from "../assets/AssetsCollection.js";
import { Backends, BackendsDefs, EdgeFunctionContext } from "./types.js";
import { generateRequestId } from "../utils/request.js";
import { getLogger, ILogger } from "../logging/index.js";
import EdgeMiddlewareStep from "../infrastructure/EdgeMiddlewareStep.js";
import VercelExecLayer from "./layers/VercelExecLayer.js";
import NextImageService from "../services/next-image.js";
import { onBeforeFetch } from "../utils/patchFetch.js";
import { getThreadLocal, setThreadLocal } from "../utils/thread-local-storage.js";

export type ServerConfig = {
  backends: Backends | 'dynamic',
  cachingKvStore?: string,
};

export type ServerConfigInit = {
  backends?: BackendsDefs,
  cachingKvStore?: string,
};

export type ServerInit = {
  modulePath?: string,
  contentAssets: ContentAssets,
  moduleAssets: ModuleAssets,
  serverConfig?: ServerConfigInit,
};

export default class VercelBuildOutputServer {
  readonly contentAssets: ContentAssets;
  readonly moduleAssets: ModuleAssets;
  readonly assetsCollection: AssetsCollection;
  readonly templateEngine: VercelBuildOutputTemplateEngine;
  readonly vercelExecLayer: VercelExecLayer;
  readonly serverConfig: ServerConfig;
  _edgeMiddlewareStep: EdgeMiddlewareStep;
  _logger: ILogger;

  constructor(
    init: ServerInit,
  ) {
    const {
      contentAssets,
      moduleAssets,
      serverConfig,
    } = init;

    this.contentAssets = contentAssets;
    this.moduleAssets = moduleAssets;

    const configJson = contentAssets.getAsset('/config.json');
    if(configJson == null || !configJson.getMetadata().text) {
      throw "Could not load text asset config.json";
    }
    const config = JSON.parse(configJson.getText());

    this.templateEngine = new VercelBuildOutputTemplateEngine(init.modulePath);

    this.assetsCollection = new AssetsCollection(
      contentAssets,
      moduleAssets,
      config.overrides,
    );

    // TODO: Move to a sort of plugin architecture
    const nextImageService = new NextImageService(this);
    this.assetsCollection.addFunctionAsset(
      '_next/image',
      nextImageService.serve.bind(nextImageService),
    );

    let backends: Backends | 'dynamic';
    if (serverConfig?.backends === 'dynamic') {
      backends = 'dynamic';
    } else {
      backends = {};
      if (serverConfig?.backends != null) {
        for (const [key, def] of Object.entries(serverConfig?.backends)) {
          let backend = def;
          if (typeof backend === 'string') {
            backend = {
              url: backend
            };
          }
          backends[key] = backend;
        }
      }
    }

    this.serverConfig = {
      backends,
      cachingKvStore: serverConfig?.cachingKvStore,
    };

    this._edgeMiddlewareStep = new EdgeMiddlewareStep({
      config,
      vercelBuildOutputServer: this,
    });

    this.vercelExecLayer = new VercelExecLayer({
      vercelBuildOutputServer: this,
    });

    this._logger = getLogger(this.constructor.name);
  }

  public async initialize() {

    // C@E services can't recursively call into themselves.
    // Hook the fetch() that goes to self and replace with a call to serveRequest.
    onBeforeFetch((_fetch, input, init) => {

      const event = getThreadLocal<FetchEvent>('fetchEvent');
      if (event == null) {
        this._logger.warn(`fetch() -- getThreadLocal('fetchEvent') was null.`);
        // Return null causes original fetch to be called
        return null;
      } else {
        const eventRequestUrl = new URL(event.request.url);
        const requestUrl = new URL(input instanceof Request ? input.url : input);
        if (eventRequestUrl.host !== requestUrl.host) {
          this._logger.warn(`fetch() -- fetch to host other than ${eventRequestUrl.host}.`);
          return null;
        }
      }

      this._logger.debug('fetch() -- detected call to self. Patching with call to serveRequest().');

      const req = new Request(input instanceof Request ? input.clone() : input, init);
      const client = event.client;

      const ctxQueue: Promise<any>[] = [];

      return (async() => {
        const response = this.serveRequest(
          req,
          client,
          {
            waitUntil(promise) {
              ctxQueue.push(promise);
            },
          }
        );

        this._logger.debug('fetch() -- returned from serveRequest().');
        this._logger.debug(response);

        while (ctxQueue.length > 0) {
          await ctxQueue.shift();
        }

        return response;
      })();

    });

    for (const assetKey of this.moduleAssets.getAssetKeys()) {
      if (assetKey.startsWith('/init/')) {
        const initModule = this.moduleAssets.getAsset(assetKey);
        if (initModule == null) {
          this._logger.warn(`asset '${assetKey}' does not exist.`);
          continue;
        }
        const fn = (await initModule.getModule()).default;
        if (typeof fn !== 'function') {
          this._logger.warn(`asset '${assetKey}' exists but does not export a function.`);
          continue;
        }
        await fn(this);
      }
    }
  }

  public createHandler() {

    return (event: FetchEvent) => {

      if (getThreadLocal('fetchEvent') != null) {
        throw new Error('Recursive call to handler created by VercelBuildOutputServer.createHandler() detected.');
      }

      setThreadLocal('fetchEvent', event);

      return this.serveRequest(
        event.request,
        event.client,
        {
          waitUntil(promise) {
            return event.waitUntil(promise);
          },
        },
      );
    };

  }

  public async serveRequest(
    request: Request,
    client: ClientInfo,
    edgeFunctionContext: EdgeFunctionContext,
  ): Promise<Response> {

    // Fastly: build requestId from POP ID
    const requestId = generateRequestId(env('FASTLY_POP') || 'local');

    // Fastly: build and ID that represents the service and version
    const serviceId = env('FASTLY_HOSTNAME') === 'localhost' ?
      `${'0'.repeat(22)}-000` :
      `${env('FASTLY_SERVICE_ID')}-${env('FASTLY_SERVICE_VERSION')}`;

    return await this._edgeMiddlewareStep.doStep({
      client,
      request,
      requestId,
      serviceId,
      edgeFunctionContext,
    });
  }
}

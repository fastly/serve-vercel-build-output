import { env } from "fastly:env";
import { ContentAssets, ModuleAssets } from "@fastly/compute-js-static-publish";
import { Config } from "../types/config.js";
import VercelBuildOutputTemplateEngine from "../templating/VercelBuildOutputTemplateEngine.js";
import AssetsCollection from "../assets/AssetsCollection.js";
import { Backends, BackendsDefs, EdgeFunctionContext, RequestContext } from "./types.js";
import { generateRequestId } from "../utils/request.js";
import { getLogger, ILogger } from "../logging/index.js";
import EdgeMiddlewareStep from "../infrastructure/EdgeMiddlewareStep.js";
import VercelExecLayer from "./layers/VercelExecLayer.js";
import { isExecLayerRequest } from "../utils/execLayer.js";

export type ServerConfig = {
  backends: Backends | 'dynamic',
  execLayerMiddlewareBackend: string | undefined,
  execLayerFunctionBackend: string | undefined,
};

export type ServerConfigInit = {
  backends?: BackendsDefs,
  execLayerMiddlewareBackend?: string,
  execLayerFunctionBackend?: string,
};

export type ServerInit = {
  modulePath?: string,
  contentAssets: ContentAssets,
  moduleAssets: ModuleAssets,
  config: Config,
  serverConfig?: ServerConfigInit,
};

export default class VercelBuildOutputServer {
  assetsCollection: AssetsCollection;
  templateEngine: VercelBuildOutputTemplateEngine;
  vercelExecLayer: VercelExecLayer;
  serverConfig: ServerConfig;
  _edgeMiddlewareStep: EdgeMiddlewareStep;
  _logger?: ILogger;

  constructor(
    init: ServerInit,
  ) {
    const { config, serverConfig } = init;

    this.templateEngine = new VercelBuildOutputTemplateEngine(init.modulePath);

    const assetsCollection = new AssetsCollection(
      init.contentAssets,
      init.moduleAssets,
      config.overrides,
    );
    this.assetsCollection = assetsCollection;

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
      execLayerMiddlewareBackend: serverConfig?.execLayerMiddlewareBackend,
      execLayerFunctionBackend: serverConfig?.execLayerFunctionBackend,
    };


    this._edgeMiddlewareStep = new EdgeMiddlewareStep({
      config,
      vercelBuildOutputServer: this,
    });

    this.vercelExecLayer = new VercelExecLayer({
      assetsCollection,
    });

    this._logger = getLogger(this.constructor.name);
  }

  public createHandler() {

    return (event: FetchEvent) => {

      return this.serveRequest(
        event.request,
        event.client,
        {
          waitUntil: event.waitUntil.bind(event),
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

    const requestContext: RequestContext = {
      client,
      request,
      requestId,
      edgeFunctionContext,
    };

    if (isExecLayerRequest(request)) {
      return await this.vercelExecLayer.execFunction(requestContext);
    }

    return await this._edgeMiddlewareStep.doStep(requestContext);
  }
}

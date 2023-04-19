import { env } from "fastly:env";
import { ContentAssets, ModuleAssets } from "@fastly/compute-js-static-publish";
import { Config } from "../types/config.js";
import VercelBuildOutputTemplateEngine from "../templating/VercelBuildOutputTemplateEngine.js";
import AssetsCollection from "../assets/AssetsCollection.js";
import { BackendsDefs, EdgeFunctionContext, RequestContext } from "./types.js";
import { generateRequestId } from "../utils/request.js";
import { getLogger, ILogger } from "../logging/index.js";
import EdgeMiddlewareStep from "../infrastructure/EdgeMiddlewareStep.js";
import VercelExecLayer from "./layers/VercelExecLayer.js";
import { isExecLayerRequest } from "../utils/execLayer.js";

export type ServerConfig = {
  backends?: BackendsDefs,
};

export type ServerInit = {
  modulePath?: string,
  contentAssets: ContentAssets,
  moduleAssets: ModuleAssets,
  config: Config,
  backends?: BackendsDefs,
};

export default class VercelBuildOutputServer {
  assetsCollection: AssetsCollection;
  templateEngine: VercelBuildOutputTemplateEngine;
  vercelExecLayer: VercelExecLayer;
  _edgeMiddlewareStep: EdgeMiddlewareStep;
  _logger?: ILogger;

  constructor(
    init: ServerInit,
  ) {
    const config = init.config;

    this.templateEngine = new VercelBuildOutputTemplateEngine(init.modulePath);

    const assetsCollection = new AssetsCollection(
      init.contentAssets,
      init.moduleAssets,
      config.overrides,
    );
    this.assetsCollection = assetsCollection;

    const backends = init.backends;
    this._edgeMiddlewareStep = new EdgeMiddlewareStep({
      config,
      vercelBuildOutputServer: this,
      backends,
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

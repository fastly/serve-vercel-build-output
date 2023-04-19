import { env } from "fastly:env";
import { getGeolocationForIpAddress } from "fastly:geolocation";
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

  _templateEngine: VercelBuildOutputTemplateEngine;

  _assetsCollection: AssetsCollection;

  _edgeMiddlewareStep: EdgeMiddlewareStep;

  _vercelExecLayer: VercelExecLayer;

  _logger?: ILogger;


  constructor(
    init: ServerInit,
  ) {
    const config = init.config;

    const templateEngine = new VercelBuildOutputTemplateEngine(init.modulePath);
    this._templateEngine = templateEngine;

    const assetsCollection = new AssetsCollection(
      init.contentAssets,
      init.moduleAssets,
      config.overrides,
    );
    this._assetsCollection = assetsCollection;

    const backends = init.backends;
    this._edgeMiddlewareStep = new EdgeMiddlewareStep({
      config,
      backends,
      templateEngine,
      assetsCollection,
    });

    this._vercelExecLayer = new VercelExecLayer({
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
      const clientAddress = request.headers.get('x-forwarded-for');
      if (clientAddress) {
        const geo = getGeolocationForIpAddress(clientAddress);
        request.headers.set('x-real-ip', clientAddress);
        request.headers.set('x-vercel-ip-city', geo.city ?? '');
        request.headers.set('x-vercel-ip-country', geo.country_code ?? '');
        request.headers.set('x-vercel-ip-country-region', geo.country_code3 ?? '');
        request.headers.set('x-vercel-ip-latitude', String(geo.latitude));
        request.headers.set('x-vercel-ip-longitude', String(geo.longitude));
      }
      return await this._vercelExecLayer.execFunction(requestContext);
    }

    return await this._edgeMiddlewareStep.doStep(requestContext);
  }
}

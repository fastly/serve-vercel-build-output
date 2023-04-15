import { env } from "fastly:env";
import { ContentAssets, ModuleAssets } from "@fastly/compute-js-static-publish";
import { Config } from "../types/config.js";
import VercelBuildOutputTemplateEngine from "../templating/VercelBuildOutputTemplateEngine.js";
import AssetsCollection from "../assets/AssetsCollection.js";
import { BackendsDefs, EdgeFunctionContext, RequestContext } from "./types.js";
import { generateRequestId } from "../utils/request.js";
import { getLogger, ILogger } from "../logging/index.js";
import EdgeMiddlewareStep from "../infrastructure/EdgeMiddlewareStep.js";

export type ServerInit = {
  modulePath?: string,
  contentAssets: ContentAssets,
  moduleAssets: ModuleAssets,
  config: Config,
  backends?: BackendsDefs,
};

const REGEX_LOCALHOST_HOSTNAME = /(?!^https?:\/\/)(127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}|::1|localhost)/;
export function parseURL(url: string | URL, base?: string | URL) {
  return new URL(String(url).replace(REGEX_LOCALHOST_HOSTNAME, "localhost"), base && String(base).replace(REGEX_LOCALHOST_HOSTNAME, "localhost"));
}

export default class VercelBuildOutputServer {

  _templateEngine: VercelBuildOutputTemplateEngine;

  _assetsCollection: AssetsCollection;

  _edgeMiddlewareStep: EdgeMiddlewareStep;

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

    // C@E uses 'host' header to build this URL.
    const initUrl = parseURL(request.url);

    // Fastly: build requestId from POP ID
    const requestId = generateRequestId(env('FASTLY_POP') || 'local');

    const requestContext: RequestContext = {
      client,
      request,
      requestId,
      initUrl,
      edgeFunctionContext,
    };

    return await this._edgeMiddlewareStep.doStep(requestContext);
  }
}

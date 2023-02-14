import { AssetsMap } from "@fastly/compute-js-static-publish";
import { Config } from "../types/config";
import TemplateEngine from "../templating/TemplateEngine";
import VercelBuildOutputTemplateEngine from "../templating/VercelBuildOutputTemplateEngine";
import AssetsCollection from "../assets/AssetsCollection";
import RoutesCollection from "../routing/RoutesCollection";
import RouteSrcMatcher from "../routing/RouteSrcMatcher";
import { RouterResultDest, RouterResultMiddleware } from "../types/routing";
import { EdgeFunction, ServeRequestContext } from "../types/server";
import RouteMatcherContext from "../routing/RouteMatcherContext";
import FunctionAsset from "../assets/FunctionAsset";
import StaticBinaryAsset from "../assets/StaticBinaryAsset";
import StaticStringAsset from "../assets/StaticStringAsset";
import RouteMatcher from "../routing/RouteMatcher";
import { processMiddlewareResponse } from "../utils/middleware";
import ILogger from "../logging/ILogger";
import { headersToObject } from "../utils/query";
import ILoggerProvider from "../logging/ILoggerProvider";

export type BackendDef = {
  url: string,
};

export type BackendsDefs = 'dynamic' | Record<string, string | BackendDef>;
export type Backends = 'dynamic' | Record<string, BackendDef>;

export type ServerInit = {
  modulePath?: string,
  assets: AssetsMap,
  config: Config,
  backendDefs?: BackendsDefs,
};

export default class VercelBuildOutputServer {

  _templateEngine: TemplateEngine;

  _assetsCollection: AssetsCollection;

  _routeMatcher: RouteMatcher;

  _backends: Backends;

  _logger?: ILogger;

  constructor(
    init: ServerInit,
    loggerProvider?: ILoggerProvider
  ) {
    const config = init.config;

    const routes = config.routes ?? [];

    const routesCollection = new RoutesCollection(routes);
    RouteSrcMatcher.init(routesCollection.routes);

    this._routeMatcher = new RouteMatcher(routesCollection, loggerProvider);
    this._routeMatcher.onCheckFilesystem =
      (pathname) => this.onCheckFilesystem(pathname);
    this._routeMatcher.onMiddleware =
      (middlewarePath, routeMatcherContext) => this.onMiddleware(middlewarePath, routeMatcherContext);

    this._templateEngine = new VercelBuildOutputTemplateEngine(init.modulePath);
    this._assetsCollection = new AssetsCollection(init.assets, config.overrides);

    this._backends = {};
    if (init.backendDefs === 'dynamic') {
      this._backends = 'dynamic';
    } else if (init.backendDefs != null) {
      for (const [key, def] of Object.entries(init.backendDefs)) {
        let backend = def;
        if (typeof backend === 'string') {
          backend = {
            url: backend
          };
        }
        this._backends[key] = backend;
      }
    }

    this._logger = loggerProvider?.getLogger(this.constructor.name);
  }

  public async serveRequest(
    request: Request,
    context: ServeRequestContext,
  ): Promise<Response> {

    const routeMatcherContext = RouteMatcherContext.fromRequest(request);
    routeMatcherContext.setContext(context);

    this._logger?.debug('context', {
      requestId: context.requestId,
    });
    this._logger?.debug('routeMatcherContext', {
      method: routeMatcherContext.method,
      host: routeMatcherContext.host,
      pathname: routeMatcherContext.pathname,
      headers: routeMatcherContext.headers,
      query: routeMatcherContext.query,
    });

    this._logger?.info('calling router');
    const routeMatchResult = await this._routeMatcher.doRouter(routeMatcherContext);
    this._logger?.info('returned from router');

    this._logger?.debug('routeMatchResult', routeMatchResult);

    this._logger?.info('routeMatchResult.type', routeMatchResult.type);
    if (routeMatchResult.type === 'middleware') {
      return this.serveMiddlewareResponse(routeMatchResult);
    }

    if (routeMatchResult.type === 'proxy') {
      return this.serveProxyResponse(routeMatchResult, routeMatcherContext);
    }

    if (routeMatchResult.type === 'filesystem') {
      return this.serveFilesystem(routeMatchResult, routeMatcherContext);
    }

    return this.serveErrorResponse();
  }

  private serveMiddlewareResponse(routeMatchResult: RouterResultMiddleware) {
    this._logger?.debug('Serving response from middleware');
    this._logger?.debug({
      status: routeMatchResult.middlewareResponse.status,
      headers: headersToObject(routeMatchResult.middlewareResponse.headers),
    });

    return routeMatchResult.middlewareResponse;
  }

  private serveProxyResponse(routeMatchResult: RouterResultDest, routeMatcherContext: RouteMatcherContext) {
    this._logger?.debug('Serving proxy response');
    this._logger?.warn('TODO: To proxying to backend ' + routeMatchResult.dest);

    const requestInit: RequestInit = {
      headers: new Headers(routeMatcherContext.headers),
    };

    if (routeMatcherContext.body != null) {
      // TODO: we have to clone here maybe
      requestInit.body = routeMatcherContext.body;
    }

    if (this._backends !== 'dynamic') {

      let backend: string | undefined;
      for (const [key, value] of Object.entries(this._backends)) {
        if (routeMatchResult.dest.startsWith(value.url)) {
          backend = key;
          break;
        }
      }

      if (backend == null) {
        this._logger?.warn('Proxying to ' + routeMatchResult.dest + ' may fail as it does not match a defined backend.');
      } else {
        requestInit.backend = backend;
      }
    }

    return fetch(routeMatchResult.dest, requestInit);
  }

  private serveFilesystem(routeMatchResult: RouterResultDest, routeMatcherContext: RouteMatcherContext) {
    const pathname = routeMatchResult.dest;

    const request = routeMatcherContext.toRequest();
    // TODO: upgrade this to NextRequest
    const context = routeMatcherContext.getContext<ServeRequestContext>();

    this._logger?.debug('Serving from filesystem');
    this._logger?.debug({
      dest: routeMatchResult.dest,
      pathname,
    });

    const asset = this._assetsCollection.getAsset(pathname);
    if (asset instanceof FunctionAsset) {
      const func = asset.module.default as EdgeFunction;
      return func(request, context);
    }
    if (asset instanceof StaticBinaryAsset || asset instanceof StaticStringAsset) {
      return new Response(asset.content, {
        status: 200,
        headers: {
          'Content-Type': asset.contentType,
        },
      });
    }
    throw new Error('asset');
  }

  private serveErrorResponse() {
    this._logger?.debug('Error response');

    return new Response('error', { 'headers': { 'content-type': 'text/plain' }});
  }

  onCheckFilesystem(pathname: string) {
    this._logger?.debug('onCheckFilesystem', {pathname});
    const result = this._assetsCollection.getAsset(pathname) != null;
    this._logger?.debug({result});
    return result;
  }

  async onMiddleware(middlewarePath: string, routeMatcherContext: RouteMatcherContext) {
    const asset = this._assetsCollection.getAsset(middlewarePath);
    if (!(asset instanceof FunctionAsset) || asset.vcConfig.runtime !== 'edge') {
      // not found (or wasn't a edge function)
      // TODO: should probably find a way to return an error.

      this._logger?.warn('Middleware ' + middlewarePath + ' not found (or not edge function), performing no-op');

      return {
        isContinue: true,
      };
    }

    const request = routeMatcherContext.toRequest();
    // TODO: upgrade this to NextRequest
    const context = routeMatcherContext.getContext<ServeRequestContext>();

    const func = asset.module.default as EdgeFunction;
    const response = await func(request, context);

    return processMiddlewareResponse(response);
  }
}

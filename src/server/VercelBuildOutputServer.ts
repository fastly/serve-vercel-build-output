import { AssetsMap } from "@fastly/compute-js-static-publish";
import { Config } from "../types/config";
import TemplateEngine from "../templating/TemplateEngine";
import VercelBuildOutputTemplateEngine from "../templating/VercelBuildOutputTemplateEngine";
import AssetsCollection from "../assets/AssetsCollection";
import RoutesCollection from "../routing/RoutesCollection";
import RouteSrcMatcher from "../routing/RouteSrcMatcher";
import { EdgeFunction, ServeRequestContext } from "../types/server";
import RouteMatcherContext from "../routing/RouteMatcherContext";
import AssetBase from "../assets/AssetBase";
import FunctionAsset from "../assets/FunctionAsset";
import StaticBinaryAsset from "../assets/StaticBinaryAsset";
import StaticStringAsset from "../assets/StaticStringAsset";
import RouteMatcher from "../routing/RouteMatcher";
import { processMiddlewareResponse } from "../utils/middleware";

type ServerInit = {
  modulePath?: string,
  assets: AssetsMap,
  config: Config,
};

export default class VercelBuildOutputServer {

  _templateEngine: TemplateEngine;

  _assetsCollection: AssetsCollection;

  _routeMatcher: RouteMatcher;

  constructor(init: ServerInit) {
    const config = init.config;

    const routes = config.routes ?? [];

    const routesCollection = new RoutesCollection(routes);
    RouteSrcMatcher.init(routesCollection.routes);

    this._routeMatcher = new RouteMatcher(routesCollection);
    this._routeMatcher.onCheckFilesystem =
      (pathname) => this.onCheckFilesystem(pathname);
    this._routeMatcher.onMiddleware =
      (middlewarePath, routeMatcherContext) => this.onMiddleware(middlewarePath, routeMatcherContext);


    this._templateEngine = new VercelBuildOutputTemplateEngine(init.modulePath);
    this._assetsCollection = new AssetsCollection(init.assets, config.overrides);
  }

  async serveRequest(
    request: Request,
    context: ServeRequestContext,
  ): Promise<Response> {

    const routeMatcherContext = RouteMatcherContext.fromRequest(request);
    routeMatcherContext.setContext(context);

    const routeMatchResult = await this._routeMatcher.doRouter(routeMatcherContext);

    if (routeMatchResult.type === 'middleware') {
      return routeMatchResult.middlewareResponse;
    }

    if (routeMatchResult.type === 'proxy') {
      // TODO: proxy this to backend
      return new Response('proxy to ' + routeMatchResult.dest, { 'headers': { 'content-type': 'text/plain' }});
    }

    if (routeMatchResult.type === 'filesystem') {
      const pathname = routeMatchResult.dest;
      const assetName = pathname.startsWith('/') ? pathname.slice(1) : pathname;

      const request = routeMatcherContext.toRequest();
      // TODO: upgrade this to NextRequest
      const context = routeMatcherContext.getContext<ServeRequestContext>();

      return this.invokeAsset(this._assetsCollection.getAsset(assetName), request, context);
    }

    console.log(routeMatchResult);

    return new Response('error', { 'headers': { 'content-type': 'text/plain' }});
  }

  onCheckFilesystem(pathname: string) {
    const assetName = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    return this._assetsCollection.getAsset(assetName) != null;
  }

  async onMiddleware(middlewarePath: string, routeMatcherContext: RouteMatcherContext) {
    const asset = this._assetsCollection.getAsset(middlewarePath);
    if (!(asset instanceof FunctionAsset) || asset.vcConfig.runtime !== 'edge') {
      // not found (or wasn't a edge function)
      // TODO: should probably find a way to return an error.
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

  invokeAsset(asset: AssetBase | null, request: Request, context: ServeRequestContext) {
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

}

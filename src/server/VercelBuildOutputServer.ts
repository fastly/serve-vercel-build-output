import { AssetsMap } from "@fastly/compute-js-static-publish";
import { HandleValue, normalizeRoutes } from "@vercel/routing-utils";
import { Config } from "../types/config";
import { TemplateEngine } from "../templating/TemplateEngine";
import { VercelBuildOutputTemplateEngine } from "../templating/VercelBuildOutputTemplateEngine";
import { AssetsCollection } from "../assets/AssetsCollection";
import { RoutesCollection } from "../routing/RoutesCollection";
import { RouteSrcMatcher } from "../routing/RouteSrcMatcher";
import { EdgeFunction, ServeRequestContext } from "../types/server";
import { RouteMatcherContext } from "../routing/RouteMatcherContext";
import { AssetBase } from "../assets/AssetBase";
import { FunctionAsset } from "../assets/FunctionAsset";
import { StaticBinaryAsset } from "../assets/StaticBinaryAsset";
import { StaticStringAsset } from "../assets/StaticStringAsset";

type ServerInit = {
  modulePath?: string,
  assets: AssetsMap,
  config: Config,
};

export default class VercelBuildOutputServer {

  _routesCollection: RoutesCollection;

  _templateEngine: TemplateEngine;

  _assetsCollection: AssetsCollection;

  constructor(init: ServerInit) {
    const config = init.config;

    const routes = config.routes ?? [];

    // validate the config
    const { routes: normalizedRoutes, error: normalizeError } = normalizeRoutes(routes);

    if(normalizeError != null) {
      throw normalizeError;
    }

    if (normalizedRoutes != null) {
      RouteSrcMatcher.init(normalizedRoutes);
    }
    this._routesCollection = new RoutesCollection(normalizedRoutes);

    this._templateEngine = new VercelBuildOutputTemplateEngine(init.modulePath);
    this._assetsCollection = new AssetsCollection(init.assets, config.overrides);
  }

  async serveRequest(
    request: Request,
    context: ServeRequestContext,
  ): Promise<Response> {

    let phase: HandleValue | null = null;
    const routeMatcherContext = RouteMatcherContext.fromRequest(request);

    if (this._assetsCollection != null) {
      return this.invokeAsset(this._assetsCollection.getAsset('api/hello'), request, context);
    }

    return new Response('ok', { 'headers': { 'content-type': 'text/plain' }});
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

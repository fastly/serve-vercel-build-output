import { AssetsMap } from "@fastly/compute-js-static-publish";
import { HandleValue, isHandler, normalizeRoutes, RouteWithSrc } from "@vercel/routing-utils";
import { Config } from "../types/config";
import { TemplateEngine } from "../templating/TemplateEngine";
import { VercelBuildOutputTemplateEngine } from "../templating/VercelBuildOutputTemplateEngine";
import { AssetsCollection } from "../assets/AssetsCollection";
import { RoutesCollection } from "../routing/RoutesCollection";
import { resolveRouteParameters, RouteSrcMatcher } from "../routing/RouteSrcMatcher";
import { EdgeFunction, HasFieldEntry, ServeRequestContext } from "../types/server";
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
    const routeMatcherContext = new RouteMatcherContext(request);

    for (const [key, value] of routeMatcherContext.headers.entries()) {
      console.log({key, value});
    }

    if (this._routesCollection != null) {

      /*
      for (const [key, value] of this.routesCollection.handleMap.entries()) {

        console.log({key, value});

      }
      */

      const nullMap = this._routesCollection.getPhaseRoutes(null);

      for (const route of nullMap) {

        if (isHandler(route)) {
          continue;
        }

        const result = this.matchRoute(route, routeMatcherContext);
        console.log({route, result});

      }

    }

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

  matchHasField(
    hasField: HasFieldEntry,
    context: RouteMatcherContext,
  ) {

    const { type } = hasField;
    switch(type) {
      case 'host':
        return hasField.value == context.host;
      case 'cookie': {
        const { key, value } = hasField;
        const cookieValue = context.cookies.get(key);
        if (cookieValue == null) {
          return false;
        }
        if (value == null) {
          return true;
        }
        // TODO: if value is a regex
        return cookieValue === value;
      }
      case 'query': {
        const { key, value } = hasField;
        const queryValue = context.query[key];
        if (queryValue == null) {
          return false;
        }
        if (value == null) {
          return true;
        }
        // TODO: if value is a regex
        return queryValue.some(v => v === value);
      }
      case 'header': {
        const { key, value } = hasField;
        const headerValue = context.headers.get(key);
        if (headerValue == null) {
          return false;
        }
        if (value == null) {
          return true;
        }
        // TODO: if value is a regex
        return headerValue === value;
      }

    }

    return false;

  }

  matchRoute(
    route: RouteWithSrc,
    context: RouteMatcherContext,
  ) {

    const { methods, has, missing } = route;

    // methods
    if (Array.isArray(methods) &&
      !methods.includes(context.method)
    ) {
      return false;
    }

    // has
    if (Array.isArray(has) &&
      !has.every(hasField => this.matchHasField(hasField, context))
    ) {
      return false;
    }

    // missing
    if (Array.isArray(missing) &&
      missing.some(hasField => this.matchHasField(hasField, context))
    ) {
      return false;
    }

    const matchResult = RouteSrcMatcher.exec(route, context.pathname);
    if (matchResult == null) {
      return false;
    }

    let destPathname = context.pathname;
    if (route.dest != null) {
      destPathname = resolveRouteParameters(route.dest, matchResult.match, matchResult.keys);
    }

    if (route.headers != null) {

    }

  }

}

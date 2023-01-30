import { AssetsMap } from "@fastly/compute-js-static-publish";
import { normalizeRoutes } from "@vercel/routing-utils";
import { Config } from "../types/config";
import { TemplateEngine } from "../templating/TemplateEngine";
import { VercelBuildOutputTemplateEngine } from "../templating/VercelBuildOutputTemplateEngine";
import { AssetsCollection } from "../assets/AssetsCollection";
import { RoutesCollection } from "../routing/RoutesCollection";
import { RouteSrcMatcher } from "../routing/RouteSrcMatcher";

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
}

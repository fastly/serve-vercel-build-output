import { AssetsMap } from "@fastly/compute-js-static-publish";
import { Config } from "../types/config";
import { TemplateEngine } from "../templating/TemplateEngine";
import { VercelBuildOutputTemplateEngine } from "../templating/VercelBuildOutputTemplateEngine";
import { AssetsCollection } from "../assets/AssetsCollection";

type ServerInit = {
  modulePath?: string,
  assets: AssetsMap,
  config: Config,
};

export default class VercelBuildOutputServer {

  _templateEngine: TemplateEngine;

  _assetsCollection: AssetsCollection;

  constructor(init: ServerInit) {
    const config = init.config;

    this._templateEngine = new VercelBuildOutputTemplateEngine(init.modulePath);
    this._assetsCollection = new AssetsCollection(init.assets, config.overrides);
  }
}

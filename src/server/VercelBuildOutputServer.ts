import { AssetsMap } from "@fastly/compute-js-static-publish";
import { Config } from "../types/config";
import { TemplateEngine } from "../templating/TemplateEngine";
import { VercelBuildOutputTemplateEngine } from "../templating/VercelBuildOutputTemplateEngine";

type ServerInit = {
  modulePath?: string,
  assets: AssetsMap,
  config: Config,
};

export default class VercelBuildOutputServer {

  _templateEngine: TemplateEngine;

  constructor(init: ServerInit) {

    this._templateEngine = new VercelBuildOutputTemplateEngine(init.modulePath);

  }
}

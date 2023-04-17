import { getLogger, ILogger } from "../logging/index.js";
import AssetsCollection from "../assets/AssetsCollection.js";
import { RouteMatcherContext, routeMatcherContextToRequest } from "../routing/RouteMatcherContext.js";
import FunctionAsset from "../assets/FunctionAsset.js";
import { RequestContext } from "../server/types.js";
import { execLayerProxy } from "../utils/execLayerProxy.js";

export type FunctionsStepInit = {
  assetsCollection: AssetsCollection,
};

export default class FunctionsStep {
  private _assetsCollection: AssetsCollection;
  private _logger: ILogger;

  constructor(init: FunctionsStepInit) {
    this._assetsCollection = init.assetsCollection;
    this._logger = getLogger(this.constructor.name);
  }

  async doStep(
    requestContext: RequestContext,
    routeMatcherContext: RouteMatcherContext,
    pathname: string,
  ) {

    const request = routeMatcherContextToRequest(routeMatcherContext);

    const asset = this._assetsCollection.getAsset(pathname);
    if (!(asset instanceof FunctionAsset)) {
      if (asset == null) {
        throw new Error(`Unknown asset: ${pathname}`);
      }
      throw new Error('Unknown asset type ' + pathname);
    }

    return await execLayerProxy(request);
  }
}

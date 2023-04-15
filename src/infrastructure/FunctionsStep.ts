import { getLogger, ILogger } from "../logging/index.js";
import AssetsCollection from "../assets/AssetsCollection.js";
import { RouteMatcherContext, routeMatcherContextToRequest } from "../routing/RouteMatcherContext.js";
import FunctionAsset from "../assets/FunctionAsset.js";
import { EdgeFunction, RequestContext } from "../server/types.js";

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

    const { edgeFunctionContext } = requestContext;

    const asset = this._assetsCollection.getAsset(pathname);
    if (!(asset instanceof FunctionAsset)) {
      if (asset == null) {
        throw new Error(`Unknown asset: ${pathname}`);
      }
      throw new Error('Unknown asset type ' + pathname);
    }
    const func = (await asset.loadModule()).default as EdgeFunction;
    return func(request, edgeFunctionContext);

  }
}

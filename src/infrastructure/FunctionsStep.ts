import { getLogger, ILogger } from "../logging/index.js";
import { RouteMatcherContext, routeMatcherContextToRequest } from "../routing/RouteMatcherContext.js";
import FunctionAsset from "../assets/FunctionAsset.js";
import { RequestContext } from "../server/types.js";
import { fetchThroughExecLayer } from "../utils/execLayer.js";
import { VercelBuildOutputServer } from "../server/index.js";

export type FunctionsStepInit = {
  vercelBuildOutputServer: VercelBuildOutputServer,
};

export default class FunctionsStep {
  private _vercelBuildOutputServer: VercelBuildOutputServer;
  private _logger: ILogger;

  constructor(init: FunctionsStepInit) {
    const {
      vercelBuildOutputServer,
    } = init;
    this._vercelBuildOutputServer = vercelBuildOutputServer;
    this._logger = getLogger(this.constructor.name);
  }

  async doStep(
    requestContext: RequestContext,
    routeMatcherContext: RouteMatcherContext,
    pathname: string,
  ) {

    const request = routeMatcherContextToRequest(routeMatcherContext);
    const client = requestContext.client;

    const asset = this._vercelBuildOutputServer.assetsCollection.getAsset(pathname);
    if (!(asset instanceof FunctionAsset)) {
      if (asset == null) {
        throw new Error(`Unknown asset: ${pathname}`);
      }
      throw new Error('Unknown asset type ' + pathname);
    }

    return await fetchThroughExecLayer(request, client);
  }
}

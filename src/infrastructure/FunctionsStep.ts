import { getLogger, ILogger } from "../logging/index.js";
import { RouteMatcherContext, routeMatcherContextToRequest } from "../routing/RouteMatcherContext.js";
import { RequestContext } from "../server/types.js";
import VercelBuildOutputServer from "../server/VercelBuildOutputServer.js";

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
    const { client, edgeFunctionContext } = requestContext;

    return await this._vercelBuildOutputServer.vercelExecLayer.execFunction(
      request,
      client,
      edgeFunctionContext,
      pathname,
      this._vercelBuildOutputServer.serverConfig.execLayerFunctionBackend,
    );
  }
}

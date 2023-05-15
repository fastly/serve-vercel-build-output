import { getLogger, ILogger } from "../logging/index.js";
import { routeMatcherContextToRequest } from "../routing/RouteMatcherContext.js";
import VercelBuildOutputServer from "../server/VercelBuildOutputServer.js";

import type { RequestContext } from "../server/types.js";
import type { RouteMatcherContext } from "../types/routing";

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
    overrideDest?: string,
  ) {

    const request = routeMatcherContextToRequest(
      routeMatcherContext,
      overrideDest,
    );
    const { client, edgeFunctionContext } = requestContext;

    // TODO: figure out how to handle the response headers relating to caching

    return await this._vercelBuildOutputServer.vercelExecLayer.execFunction(
      request,
      client,
      edgeFunctionContext,
      routeMatcherContext.pathname,
      this._vercelBuildOutputServer.serverConfig.execLayerFunctionBackend,
    );
  }
}

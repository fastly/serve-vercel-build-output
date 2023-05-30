import { getLogger, ILogger } from "../logging/index.js";
import VercelBuildOutputServer from "../server/VercelBuildOutputServer.js";

import type { RequestContext } from "../server/types.js";

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
    request: Request,
  ) {

    const { client, edgeFunctionContext } = requestContext;

    // TODO: figure out how to handle the response headers relating to caching

    return await this._vercelBuildOutputServer.vercelExecLayer.execFunction(
      request,
      client,
      edgeFunctionContext,
      this._vercelBuildOutputServer.serverConfig.execLayerFunctionBackend,
    );
  }
}

import { RequestContext } from "../server/types.js";
import FunctionAsset from "../assets/FunctionAsset.js";
import StaticAsset from "../assets/StaticAsset.js";
import { getLogger, ILogger } from "../logging/index.js";
import FunctionsStep from "./FunctionsStep.js";
import VercelBuildOutputServer from "../server/VercelBuildOutputServer.js";
import { RouteMatcherContext } from "../types/routing";

export type EdgeNetworkCacheStepInit = {
  vercelBuildOutputServer: VercelBuildOutputServer,
};

export default class EdgeNetworkCacheStep {
  private _vercelBuildOutputServer: VercelBuildOutputServer;
  private _functionsStep: FunctionsStep;

  private _logger: ILogger;

  constructor(init: EdgeNetworkCacheStepInit) {
    const {
      vercelBuildOutputServer,
    } = init;
    this._vercelBuildOutputServer = vercelBuildOutputServer;
    this._functionsStep = new FunctionsStep({
      vercelBuildOutputServer,
    });

    this._logger = getLogger(this.constructor.name);
  }

  async doStep(
    requestContext: RequestContext,
    routeMatcherContext: RouteMatcherContext,
    overrideDest?: string,
  ) {

    const { pathname } = routeMatcherContext;
    this._logger.debug('Serving from filesystem', { pathname });

    const asset = this._vercelBuildOutputServer.assetsCollection.getAsset(pathname);

    if (asset instanceof StaticAsset) {
      // Static items are always "cached"
      // They are served from KV (if enabled) or from inline (at the edge)
      const storeEntry = await asset.contentAsset.getStoreEntry();
      return new Response(storeEntry.body, {
        status: 200,
        headers: {
          'Content-Type': asset.contentType,
        },
      });
    }
    if (asset instanceof FunctionAsset) {
      return await this._functionsStep.doStep(requestContext, routeMatcherContext, overrideDest);
    }

    if (asset == null) {
      throw new Error(`Unknown asset: ${pathname}`);
    }
    throw new Error('Unknown asset type ' + pathname);
  }
}

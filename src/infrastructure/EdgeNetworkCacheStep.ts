import { RequestContext } from "../server/types.js";
import FunctionAsset from "../assets/FunctionAsset.js";
import StaticAsset from "../assets/StaticAsset.js";
import { getLogger, ILogger } from "../logging/index.js";
import AssetsCollection from "../assets/AssetsCollection.js";
import FunctionsStep from "./FunctionsStep.js";
import {RouteMatcherContext} from "../routing/RouteMatcherContext.js";

export type EdgeNetworkCacheStepInit = {
  assetsCollection: AssetsCollection,
};

export default class EdgeNetworkCacheStep {
  private _assetsCollection: AssetsCollection;
  private _functionsStep: FunctionsStep;

  private _logger: ILogger;

  constructor(init: EdgeNetworkCacheStepInit) {
    const { assetsCollection } = init;
    this._assetsCollection = assetsCollection;
    this._functionsStep = new FunctionsStep({
      assetsCollection,
    });

    this._logger = getLogger(this.constructor.name);
  }

  async doStep(
    requestContext: RequestContext,
    routeMatcherContext: RouteMatcherContext,
    pathname: string,
  ) {

    this._logger?.debug('Serving from filesystem');
    this._logger?.debug({
      pathname,
    });

    const asset = this._assetsCollection.getAsset(pathname);

    if (asset instanceof StaticAsset) {
      const storeEntry = await asset.contentAsset.getStoreEntry();
      return new Response(storeEntry.body, {
        status: 200,
        headers: {
          'Content-Type': asset.contentType,
        },
      });
    }
    if (!(asset instanceof FunctionAsset)) {
      if (asset == null) {
        throw new Error(`Unknown asset: ${pathname}`);
      }
      throw new Error('Unknown asset type ' + pathname);
    }

    return await this._functionsStep.doStep(requestContext, routeMatcherContext, pathname);
  }
}

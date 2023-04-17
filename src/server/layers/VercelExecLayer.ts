import AssetsCollection from "../../assets/AssetsCollection.js";
import FunctionAsset from "../../assets/FunctionAsset.js";
import { EdgeFunction, RequestContext } from "../types.js";
import { getLogger, ILogger } from "../../logging/index.js";
import { fromExecLayerPath, fromExecLayerRequest } from "../../utils/execLayerProxy.js";

export type VercelExecLayerInit = {
  assetsCollection: AssetsCollection,
}

export default class VercelExecLayer {
  private _assetsCollection: AssetsCollection;
  private _logger: ILogger;

  constructor(
    init: VercelExecLayerInit
  ) {
    const { assetsCollection } = init;
    this._assetsCollection = assetsCollection;
    this._logger = getLogger(this.constructor.name);
  }

  async execFunction(
    requestContext: RequestContext,
  ) {
    const { request: execLayerRequest, edgeFunctionContext, initUrl } = requestContext;

    const request = fromExecLayerRequest(execLayerRequest);

    const pathname = fromExecLayerPath(initUrl.pathname);

    const asset = this._assetsCollection.getAsset(pathname);
    if (!(asset instanceof FunctionAsset) || asset.vcConfig.runtime !== 'edge') {
      // not found (or wasn't a edge function)
      // TODO: should probably find a way to return an error.

      this._logger?.warn('Function ' + pathname + ' not found (or not edge function)');
      throw new Error('Function ' + pathname + ' not found (or not edge function)');
    }

    const func = (await asset.loadModule()).default as EdgeFunction;
    return await func(request, edgeFunctionContext);
  }
}

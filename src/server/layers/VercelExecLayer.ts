import AssetsCollection from "../../assets/AssetsCollection.js";
import FunctionAsset from "../../assets/FunctionAsset.js";
import { EdgeFunction, RequestContext } from "../types.js";
import { getLogger, ILogger } from "../../logging/index.js";
import { execLayerFunctionPathnameFromRequest } from "../../utils/execLayer.js";

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
    const { request, edgeFunctionContext } = requestContext;
    const functionPathname = execLayerFunctionPathnameFromRequest(request);

    const asset = this._assetsCollection.getAsset(functionPathname);
    if (!(asset instanceof FunctionAsset) || asset.vcConfig.runtime !== 'edge') {
      // not found (or wasn't a edge function)
      // TODO: should probably find a way to return an error.

      this._logger?.warn('Function ' + functionPathname + ' not found (or not edge function)');
      throw new Error('Function ' + functionPathname + ' not found (or not edge function)');
    }

    const func = (await asset.loadModule()).default as EdgeFunction;

    // Exec layer request contains the function path encoded with /_xl/ path, as well as the original
    // request pathname (if different from function path) encoded in the x-xl-orig-pathname header.
    // This translates those back into a Request object that will contain their original values,
    // before we pass it to the edge function.

    return await func(request, edgeFunctionContext);
  }
}

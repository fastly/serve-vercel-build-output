import { getGeolocationForIpAddress } from "fastly:geolocation";
import FunctionAsset from "../../assets/FunctionAsset.js";
import { EdgeFunction, EdgeFunctionContext } from "../types.js";
import { getLogger, ILogger } from "../../logging/index.js";
import { prepareExecLayerRequest } from "../../utils/execLayer.js";
import VercelBuildOutputServer from "../VercelBuildOutputServer.js";

declare global {
  var FASTLY_SVBO_PWD: string;
}

export type VercelExecLayerInit = {
  vercelBuildOutputServer: VercelBuildOutputServer,
}

export default class VercelExecLayer {
  private _vercelBuildOutputServer: VercelBuildOutputServer;
  private _logger: ILogger;

  constructor(
    init: VercelExecLayerInit
  ) {
    const {
      vercelBuildOutputServer,
    } = init;
    this._vercelBuildOutputServer = vercelBuildOutputServer;
    this._logger = getLogger(this.constructor.name);
  }

  async execFunction(
    request: Request,
    client: ClientInfo,
    edgeFunctionContext: EdgeFunctionContext,
    functionPathname: string,
    backend: string | undefined,
  ) {
    const asset = this._vercelBuildOutputServer.assetsCollection.getAsset(functionPathname);
    if (!(asset instanceof FunctionAsset) || asset.vcConfig.runtime !== 'edge') {
      // not found (or wasn't a edge function)
      // TODO: should probably find a way to return an error.

      this._logger.warn('Function ' + functionPathname + ' not found (or not edge function)');
      throw new Error('Function ' + functionPathname + ' not found (or not edge function)');
    }

    let clientAddress = request.headers.get('x-real-ip') ?? '';
    if (!clientAddress) {
      clientAddress = client.address ?? '';
      if (clientAddress) {
        request.headers.set('x-real-ip', clientAddress);
      }
    }

    request.headers.set('x-matched-path', functionPathname);

    if (backend != null) {
      // TODO: Also handle dynamic backends
      prepareExecLayerRequest(request, functionPathname);
      return await fetch(request, {
        backend,
      });
    }

    if (clientAddress) {
      const geo = getGeolocationForIpAddress(clientAddress);
      request.headers.set('x-vercel-ip-city', geo.city ?? '');
      request.headers.set('x-vercel-ip-country', geo.country_code ?? '');
      request.headers.set('x-vercel-ip-country-region', geo.country_code3 ?? '');
      request.headers.set('x-vercel-ip-latitude', String(geo.latitude));
      request.headers.set('x-vercel-ip-longitude', String(geo.longitude));
    }

    const prevPwd = globalThis.FASTLY_SVBO_PWD;
    try {
      globalThis.FASTLY_SVBO_PWD = asset.canonicalKey;
      const func = (await asset.loadModule()).default as EdgeFunction;
      return await func(request, edgeFunctionContext);
    } finally {
      globalThis.FASTLY_SVBO_PWD = prevPwd;
    }
  }
}

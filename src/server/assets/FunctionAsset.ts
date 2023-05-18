import { ModuleAsset } from "@fastly/compute-js-static-publish";
import AssetBase from "./AssetBase.js";

export type VercelFunctionConfig = {
  runtime: 'edge',
  name: string,
  deploymentTarget: 'v8-worker',
  entrypoint: string,
  envVarsInUse: string[],
  assets: { name: string; path: string }[],
};

export type PrerenderFunctionConfig = {
  type?: "Prerender";
  expiration: number | false;
  group?: number;
  bypassToken?: string;
  fallback?: string;
  allowQuery?: string[];
};

export default class FunctionAsset extends AssetBase {
  private readonly asset: ModuleAsset;

  async loadModule(): Promise<any> {
    // getModule() is smart enough to return the same promise on multiple
    // invocations.
    return this.asset.getModule();
  }

  vcConfig: VercelFunctionConfig;
  prerenderConfig: PrerenderFunctionConfig | undefined;

  constructor(
    key: string,
    canonicalKey: string,
    asset: ModuleAsset,
    vcConfig: VercelFunctionConfig,
    prerenderConfig: PrerenderFunctionConfig | undefined,
  ) {
    super(key, canonicalKey);
    this.asset = asset;
    this.vcConfig = vcConfig;
    this.prerenderConfig = prerenderConfig;
  }
}

import { Asset } from "@fastly/compute-js-static-publish";
import AssetBase from "./AssetBase";

export type VercelFunctionConfig = {
  runtime: 'edge',
  name: string,
  deploymentTarget: 'v8-worker',
  entrypoint: string,
  envVarsInUse: string[],
  assets: { name: string; path: string }[],
};

export default class FunctionAsset extends AssetBase {
  private readonly _moduleLoader: (() => Promise<any>) | undefined;

  async loadModule(): Promise<any> {
    if (this._moduleLoader == null) {
      throw new Error('Asset ' + this.key + ' cannot be loaded as a module');
    }
    return this._moduleLoader;
  }

  vcConfig: VercelFunctionConfig;

  constructor(key: string, asset: Asset, vcConfig: VercelFunctionConfig) {
    super(key);

    if (asset.loadModule != null) {
      this._moduleLoader = asset.loadModule;
    } else if (asset.module) {
      this._moduleLoader = () => new Promise<any>(resolve => resolve(asset.module));
    }

    this.vcConfig = vcConfig;
  }
}

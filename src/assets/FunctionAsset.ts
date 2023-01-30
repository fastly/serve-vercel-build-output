import { Asset } from "@fastly/compute-js-static-publish";
import { AssetBase } from "./AssetBase";

export type VercelFunctionConfig = {
  runtime: 'edge',
  name: string,
  deploymentTarget: 'v8-worker',
  entrypoint: string,
  envVarsInUse: string[],
  assets: { name: string; path: string }[],
};

export class FunctionAsset extends AssetBase {
  module: any;

  vcConfig: VercelFunctionConfig;

  constructor(key: string, asset: Asset, vcConfig: VercelFunctionConfig) {
    super(key);
    this.module = asset.module;
    this.vcConfig = vcConfig;
  }

}

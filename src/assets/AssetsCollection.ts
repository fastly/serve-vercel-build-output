import { AssetsMap } from "@fastly/compute-js-static-publish";
import { PathOverride } from "../types/config";
import AssetBase from "./AssetBase";
import StaticBinaryAsset from "./StaticBinaryAsset";
import StaticStringAsset from "./StaticStringAsset";
import FunctionAsset, { VercelFunctionConfig } from "./FunctionAsset";
import StaticAsset from "./StaticAsset";

function adjustIndexPathname(pathname: string) {
  let adjustedPathname = pathname;
  if (adjustedPathname === 'index') {
    adjustedPathname = '/';
  } else if (adjustedPathname.endsWith('/index')) {
    adjustedPathname = adjustedPathname.slice(0, -('/index'.length));
  }
  return adjustedPathname;
}

export default class AssetsCollection {

  assets: Record<string, AssetBase>;

  constructor(
    assetsMap: AssetsMap,
    overrides?: Record<string, PathOverride>,
  ) {
    this.assets = {};

    for (const [key, value] of Object.entries(assetsMap)) {

      if(key.startsWith('/static/')) {

        const path = key.slice('/static/'.length);
        let assetKey = adjustIndexPathname(path);

        if (this.assets[assetKey] != null) {
          // shouldn't happen, but if duplicate def, then skip
          continue;
        }

        let asset;
        if (value.type === 'binary') {
          asset = new StaticBinaryAsset(assetKey, value);
        } else {
          asset = new StaticStringAsset(assetKey, value);
        }
        this.assets[assetKey] = asset;

      }

      if (key.startsWith('/functions/') && key.endsWith('.func/.vc-config.json')) {

        if (value.type !== 'string') {
          // shouldn't happen, but if type isn't string, then give up
          continue;
        }

        const vcConfigStr = value.content;
        const vcConfig = JSON.parse(vcConfigStr) as VercelFunctionConfig;

        let functionName = vcConfig.name;
        if (functionName == null) {
          // Function name is the current directory, but
          // with leading /functions/ and trailing .func removed.
          functionName = key.slice('/functions/'.length);
          functionName = functionName.slice(0, functionName.lastIndexOf('.func/.vc-config.json'));
        }

        const entrypoint = `/functions/${functionName}.func/` + (vcConfig.entrypoint ?? 'index.js');
        const functionAsset = assetsMap[entrypoint];
        if (functionAsset == null) {
          // shouldn't happen
          console.warn( 'Entry point ' + entrypoint + ' does not exist');
          continue;
        }

        let assetKey = adjustIndexPathname(functionName);
        this.assets[assetKey] = new FunctionAsset(assetKey, functionAsset, vcConfig);
      }

    }

    // It's hard to tell what the right behavior is here...
    if (overrides != null) {
      for (const [key, value] of Object.entries(overrides)) {
        const existingAsset = this.assets[key];
        if (!(existingAsset instanceof StaticAsset)) {
          // ignore it if it doesn't exist
          continue;
        }

        // for now, we're going to adjust the existing entry
        if (value.contentType != null) {
          existingAsset.contentType = value.contentType;
        }

        // for now, we're going to add another entry to map to the same item
        if (value.path != null) {
          const assetKey = adjustIndexPathname(value.path);
          if (this.assets[assetKey] == null) {
            this.assets[assetKey] = existingAsset;
          }
        }
      }
    }
  }

  getAsset(key: string) {
    let assetKey = key;
    if (assetKey !== '/' && assetKey.startsWith('/')) {
      assetKey = assetKey.slice(1);
    }
    return this.assets[assetKey];
  }

}

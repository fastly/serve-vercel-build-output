import { ContentAssets, ModuleAssets } from "@fastly/compute-js-static-publish";
import { PathOverride } from "../types/config.js";
import AssetBase from "./AssetBase.js";
import FunctionAsset, { VercelFunctionConfig } from "./FunctionAsset.js";
import StaticAsset from "./StaticAsset.js";

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
    contentAssets: ContentAssets,
    moduleAssets: ModuleAssets,
    overrides?: Record<string, PathOverride>,
  ) {
    this.assets = {};

    for (const key of contentAssets.getAssetKeys()) {

      const value = contentAssets.getAsset(key);
      if (value == null) {
        // shouldn't happen
        continue;
      }

      if(key.startsWith('/static/')) {

        const path = key.slice('/static/'.length);
        let assetKey = adjustIndexPathname(path);

        if (this.assets[assetKey] != null) {
          // shouldn't happen, but if duplicate def, then skip
          continue;
        }


        this.assets[assetKey] = new StaticAsset(assetKey, value);

      }

      if (key.startsWith('/functions/') && key.endsWith('.func/.vc-config.json')) {

        if (!value.getMetadata().text) {
          // shouldn't happen, but if the content isn't text, then give up
          continue;
        }

        if (!value.isLocal) {
          // vc-config.json must be locally available
          throw new Error('.vc-config.json must be locally available.');
        }

        const vcConfigStr = value.getText();
        const vcConfig = JSON.parse(vcConfigStr) as VercelFunctionConfig;

        let functionName = vcConfig.name;
        if (functionName == null) {
          // Function name is the current directory, but
          // with leading /functions/ and trailing .func removed.
          functionName = key.slice('/functions/'.length);
          functionName = functionName.slice(0, functionName.lastIndexOf('.func/.vc-config.json'));
        }

        const entrypoint = `/functions/${functionName}.func/` + (vcConfig.entrypoint ?? 'index.js');
        const functionAsset = moduleAssets.getAsset(entrypoint);
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

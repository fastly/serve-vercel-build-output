import { AssetsMap } from "@fastly/compute-js-static-publish";
import { PathOverride } from "../types/config";
import AssetBase from "./AssetBase";
import StaticBinaryAsset from "./StaticBinaryAsset";
import StaticStringAsset from "./StaticStringAsset";
import FunctionAsset, { VercelFunctionConfig } from "./FunctionAsset";
import StaticAsset from "./StaticAsset";

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

        if (this.assets[path] != null) {
          // shouldn't happen, but if duplicate def, then skip
          continue;
        }

        let asset;
        if (value.type === 'binary') {
          asset = new StaticBinaryAsset(path, value);
        } else {
          asset = new StaticStringAsset(path, value);
        }
        this.assets[path] = asset;

      }

      if (key.startsWith('/functions/') && key.endsWith('.func/.vc-config.json')) {

        if (value.type !== 'string') {
          // shouldn't happen, but if type isn't string, then give up
          continue;
        }

        const vcConfigStr = value.content;
        const vcConfig = JSON.parse(vcConfigStr) as VercelFunctionConfig;

        const entrypoint = '/functions/' + vcConfig.name + '.func/' + vcConfig.entrypoint;
        const functionAsset = assetsMap[entrypoint];
        if (functionAsset == null) {
          // shouldn't happen
          console.warn( 'Entry point ' + entrypoint + ' does not exist');
          continue;
        }

        this.assets[vcConfig.name] = new FunctionAsset(vcConfig.name, functionAsset, vcConfig);
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
        if (value.path != null && this.assets[value.path] == null) {
          this.assets[value.path] = existingAsset;
        }
      }
    }

  }

  getAsset(key: string) {
    return this.assets[key];
  }

}

import path from "path-browserify";
import { ContentAssets, ModuleAsset, ModuleAssets } from "@fastly/compute-js-static-publish";

import { PathOverride } from "../types/config.js";
import AssetBase from "./AssetBase.js";
import FunctionAsset, {
  PrerenderFunctionConfig,
  VercelFunctionConfig,
} from "./FunctionAsset.js";
import StaticAsset from "./StaticAsset.js";

import type { EdgeFunction } from "../server/types.js";

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

        this.assets[assetKey] = new StaticAsset(assetKey, key, value);

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
          console.warn( `Entry point ${entrypoint} does not exist`);
          continue;
        }

        let prerenderConfig: PrerenderFunctionConfig | undefined;

        const prerenderConfigFilename = `/functions/${functionName}.prerender-config.json`;
        const prerenderConfigAsset = contentAssets.getAsset(prerenderConfigFilename);
        if (prerenderConfigAsset != null) {
          if (!prerenderConfigAsset.isLocal) {
            console.warn(`Prerender-config file ${prerenderConfigFilename} must be locally available.`);
          } else {
            const prerenderConfigStr = prerenderConfigAsset.getText();
            prerenderConfig = JSON.parse(prerenderConfigStr) as PrerenderFunctionConfig;

            const fallbackField = prerenderConfig.fallback as any;

            let fallback: string | undefined = undefined;

            if (typeof fallbackField === 'string') {
              fallback = fallbackField;
            } else {
              const type = fallbackField?.type as string;
              if (type === 'FileFsRef') {
                if (typeof fallbackField.fsPath === 'string') {
                  fallback = fallbackField.fsPath;
                } else {
                  console.warn(`FileFsRef of ${prerenderConfigFilename} does not have a string fsPath value, ignoring.`);
                }
              }
            }

            if (fallback != null) {
              const fallbackAssetKey = path.resolve(
                path.dirname(prerenderConfigFilename),
                fallback
              );

              const fallbackAsset = contentAssets.getAsset(fallbackAssetKey);
              if (fallbackAsset == null) {
                console.warn(`Fallback asset ${fallbackAssetKey} of ${prerenderConfigFilename} does not exist, ignoring.`);
              } else {
                prerenderConfig.fallback = fallbackAssetKey;
              }
            }
          }
        }

        const canonicalKey = key.slice(0, key.lastIndexOf('/.vc-config.json'));

        let assetKey = adjustIndexPathname(functionName);
        this.assets[assetKey] = new FunctionAsset(
          assetKey,
          canonicalKey,
          functionAsset,
          vcConfig,
          prerenderConfig,
        );
      }

    }

    // SPEC: https://vercel.com/docs/build-output-api/v3/configuration#overrides
    // The overrides property allows for overriding the output of one or more static files contained
    // within the .vercel/output/static directory.
    if (overrides != null) {
      // Note Object.entries() returns items in insertion order.
      for (const [key, value] of Object.entries(overrides)) {
        const existingAsset = this.assets[key];
        if (!(existingAsset instanceof StaticAsset)) {
          // ignore it if it doesn't exist or if it isn't a static asset
          continue;
        }

        // override the content type if it's defined
        if (value.contentType != null) {
          existingAsset.contentType = value.contentType;
        }

        // Replace the entry
        // NOTE: This means the asset can no longer be accessed using the original asset key.
        // NOTE: If a later override maps to replaced entry of an earlier one, then the replacements
        // are chained. The asset cannot be accessed using the intermediary asset keys.
        // NOTE: If two or more overrides have the same replacement value, the last one stands, and
        // the asset that was replaced by all but the last override can no longer be accessed!
        // This is because overrides are applied in insertion order.
        if (value.path != null) {
          const assetKey = adjustIndexPathname(value.path);
          this.assets[assetKey] = existingAsset;
          delete this.assets[key];
        }
      }
    }
  }

  getAsset(key: string) {
    let assetKey = key;
    if (
      assetKey !== '/' &&
      assetKey.startsWith('/')
    ) {
      assetKey = assetKey.slice(1);
    }
    let asset = this.assets[assetKey];
    if (
      asset == null &&
      assetKey.endsWith('/')
    ) {
      assetKey = assetKey.slice(0, -1);
      asset = this.assets[assetKey];
    }
    return asset;
  }

  addFunctionAsset(
    assetKey: string,
    edgeFunction: EdgeFunction,
  ) {
    const module = {
      'default': edgeFunction,
    };
    const modulePromise = Promise.resolve(module);

    const functionAsset: ModuleAsset = {
      assetKey,
      isStaticImport: true,
      getModule(): Promise<any> {
        return modulePromise;
      },
      getStaticModule(): any {
        return module;
      },
    };

    this.assets[assetKey] = new FunctionAsset(
      assetKey,
      '',
      functionAsset,
      {
        runtime: 'edge',
        name: assetKey,
        deploymentTarget: 'v8-worker',
        entrypoint: '',
        envVarsInUse: [],
        assets: [],
      },
      undefined,
    );
  }

}

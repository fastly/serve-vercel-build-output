import path from 'path';

import type { Configuration } from 'webpack';

import { applyToPackages, getDependencies } from "../util/dependencies";
import {
  SVBO_OPTIONS_KEY,
  SVBO_WEBPACK_TRANSFORM_KEY,
} from "../constants";
import {
  TransformPackageJson
} from "../types";

type WebpackConfigTransformFunction = (config: Configuration, webpack: any) => Configuration;

export function applyWebpackTransform(config: Configuration, webpack: any) {

  let entryPoints: string[];
  if (Array.isArray(config.entry)) {
    entryPoints = config.entry;
  } else if (typeof config.entry === 'string') {
    entryPoints = [ config.entry ];
  } else {
    throw new Error(`@fastly/serve-vercel-build-output's webpack transform currently only supports entry values of single string or array of string.`);
  }

  let theConfig: Configuration = {
    ...config,
    entry: [
      require.resolve("@fastly/serve-vercel-build-output/polyfills"),
      ...entryPoints,
    ],
  };

  const dependencies = getDependencies();
  applyToPackages<TransformPackageJson>(dependencies, (packageJson, ctx) => {

    let transformScript = packageJson?.[SVBO_OPTIONS_KEY]?.[SVBO_WEBPACK_TRANSFORM_KEY];
    if (transformScript == null) {
      return;
    }

    const transformScriptPath = path.resolve(ctx.packagePath, transformScript);

    const defaultImport = (require(transformScriptPath).default) as any;
    if (typeof defaultImport !== 'function') {
      return;
    }

    const transformFunction = defaultImport as WebpackConfigTransformFunction;
    theConfig = transformFunction(theConfig, webpack);

  });

  return theConfig;

}

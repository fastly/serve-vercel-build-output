import { PackageJson } from './util/dependencies';
import {
  SVBO_OPTIONS_KEY,
  SVBO_ASSET_TRANSFORM_KEY,
  SVBO_WEBPACK_TRANSFORM_KEY,
} from './constants';

export type ServeVercelBuildOutputOptions = {
  [SVBO_ASSET_TRANSFORM_KEY]?: string | string[],
  [SVBO_WEBPACK_TRANSFORM_KEY]?: string,
};

export type TransformPackageJson = PackageJson & {
  [SVBO_OPTIONS_KEY]?: ServeVercelBuildOutputOptions,
};

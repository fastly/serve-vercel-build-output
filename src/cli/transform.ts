#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'node:module';

// This type is declared here too because the declaration is outside of rootDir
type TransformContext = {
  transformName: string,             // package name of the transform
  transformScript: string,           // script name within package
  functionPath: string,              // relative function path (relative to vercel output dir)
  functionFilesSourcePath: string,   // full local path to original copy of function files
  functionFilesTargetPath: string,   // full local path to default target copy of function files
  nextProjectPath: string,           // full local path to project files
  buildOutputPath: string,           // full local path to build output path
};
type TransformContextBase = Pick<TransformContext, 'nextProjectPath' | 'buildOutputPath'>;

const SVBO_TRANSFORM_KEY = '@fastly/vercel-transform';
const TRANSFORM_DEFAULT_PRIORITY = 10;

const TRANSFORM_TYPES = [
  'transformFunction',
  // and maybe 'transformStatic' too in the future?
];

type PackageJson = {
  name: string,
  dependencies?: Record<string, string>,
  devDependencies?: Record<string, string>,
  [SVBO_TRANSFORM_KEY]?: string | string[],
};

type TransformFunction = {
  (ctx: TransformContext): Promise<void>,
  transformType: string,
  priority?: number,
  module?: string,
  script?: string,
};

const require = createRequire(import.meta.url);

// TODO: Turn these into command-line arguments?

const NEXT_PROJECT_PATH = path.resolve('../');
const TRANSFORM_SOURCE_DIR = path.resolve('../.vercel/output');
const TRANSFORM_TARGET_DIR = path.resolve('./.build');

const VERCEL_CONFIG_FILENAME = 'config.json';

const VERCEL_STATIC_DIRNAME = 'static';
const VERCEL_FUNCTIONS_DIRNAME = 'functions';

await main();

export async function main() {

  // Enumerate transform functions.
  // Transform functions are scripts that are pointed to by the '@fastly/vercel-transform' key
  // in individual package.json files of dependencies and devDependencies of the compute project
  const dependencies = getDependencies();
  const transforms = findTransforms(dependencies);

  // Start the copy / transform operation
  fs.rmSync(TRANSFORM_TARGET_DIR, { recursive: true, force: true });

  const ctxBase: TransformContextBase = {
    nextProjectPath: NEXT_PROJECT_PATH,
    buildOutputPath: TRANSFORM_TARGET_DIR,
  };

  fs.mkdirSync(TRANSFORM_TARGET_DIR, { recursive: true });

  await copyConfigFile();

  // At the end, writes the context object to ./.svbo.json
  // This is used by webpack.config.js to decide whether to load the polyfills needed by next-compute-js-server

  await copyStaticFiles(ctxBase);

  await copyFunctionFiles(ctxBase, transforms);



}


function getDependencies(): string[] {

  const packageJsonFilePath = path.resolve('./package.json');
  const packageJsonFileContents = fs.readFileSync(packageJsonFilePath, 'utf-8');
  const packageJson = JSON.parse(packageJsonFileContents) as PackageJson;

  return [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ];

}

function findTransforms(dependencies: string[]) {

  const transforms: TransformFunction[] = [];

  for (const dependency of dependencies) {

    const packageJsonFilePath = require.resolve(dependency + '/package.json');
    const packageJsonFileContents = fs.readFileSync(packageJsonFilePath, 'utf-8');
    const packageJson = JSON.parse(packageJsonFileContents) as PackageJson;

    let transformScripts = packageJson?.[SVBO_TRANSFORM_KEY];
    if (transformScripts == null) {
      transformScripts = [];
    } else if (!Array.isArray(transformScripts)) {
      transformScripts = [ transformScripts ];
    }

    for (const transformScript of transformScripts) {
      const transformScriptPath = path.resolve(path.dirname(packageJsonFilePath), transformScript);

      const defaultImport = (require(transformScriptPath).default) as any;
      if (
        typeof defaultImport !== 'function' ||
        !TRANSFORM_TYPES.includes(defaultImport.transformType)
      ) {
        continue;
      }

      const transformFunction = defaultImport as TransformFunction;
      transformFunction.module = dependency;
      transformFunction.script = transformScript;
      if (transformFunction.priority == null) {
        transformFunction.priority = TRANSFORM_DEFAULT_PRIORITY;
      }

      transforms.push(transformFunction);
    }

  }

  transforms.sort((a, b) => {
    return a.priority! - b.priority!;
  });

  return transforms;

}

function copyConfigFile() {
  fs.cpSync(
    path.join(TRANSFORM_SOURCE_DIR, VERCEL_CONFIG_FILENAME),
    path.join(TRANSFORM_TARGET_DIR, VERCEL_CONFIG_FILENAME),
  );
}

async function copyWorker(
  src: string,
  dest: string,
  action?: (src: string, dest: string, isDirectory: boolean) => boolean | Promise<boolean>,
) {
  if (!fs.existsSync(src)) {
    return;
  }
  fs.mkdirSync(dest);

  const files = fs.readdirSync(src);
  for (const file of files) {
    const srcFilePath = path.join(src, file);
    const destFilePath = path.join(dest, file);
    const stat = fs.statSync(srcFilePath);
    // if (stat.isSymbolicLink()) {
    //   // skip links for now
    //   console.log(`${srcFilePath} is a link, skipping...`);
    //   continue;
    // }
    const isDirectory = stat.isDirectory();
    const result = action != null ? await action(srcFilePath, destFilePath, isDirectory) : true;

    // if this returned true, then it means we should copy it
    if (result) {
      console.log(`Copying ${srcFilePath} to ${destFilePath}.`)
      if (isDirectory) {
        await copyWorker(
          srcFilePath,
          destFilePath,
          action,
        );
      } else {
        fs.copyFileSync(
          srcFilePath,
          destFilePath,
        );
      }
    }
  }

}

async function copyStaticFiles(
  ctxBase: TransformContextBase,
) {
  await copyWorker(
    path.join(TRANSFORM_SOURCE_DIR, VERCEL_STATIC_DIRNAME),
    path.join(TRANSFORM_TARGET_DIR, VERCEL_STATIC_DIRNAME),
    src => {
      if (path.basename(src) === '__private') {
        return false;
      }
      return true;
    }
  );
}

async function copyFunctionFiles(
  ctxBase: TransformContextBase,
  transformFunctions: TransformFunction[],
) {

  const applicableFunctions = transformFunctions
    .filter(x => x.transformType === 'transformFunction');

  await copyWorker(
    path.join(TRANSFORM_SOURCE_DIR, VERCEL_FUNCTIONS_DIRNAME),
    path.join(TRANSFORM_TARGET_DIR, VERCEL_FUNCTIONS_DIRNAME),
    async (src, dest, isDirectory) => {
      if (!isDirectory || !src.endsWith('.func')) {
        return true;
      }

      // This is a single function
      for (const fn of applicableFunctions) {
        const ctx = {
          ...ctxBase,
          transformName: fn.module ?? '',
          transformScript: fn.script ?? '',
          functionPath: '/' + path.relative(TRANSFORM_SOURCE_DIR, src),
          functionFilesSourcePath: src,
          functionFilesTargetPath: dest,
        };

        await fn(ctx);
      }

      return false;
    }
  );
}

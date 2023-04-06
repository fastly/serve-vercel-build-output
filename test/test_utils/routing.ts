import assert from "assert";
import fs from "fs";
import path from "path";
import {
  ContentAssetMetadataMap,
  ContentAssets,
  ModuleAssetMap,
  ModuleAssets,
  testFileContentType
} from "@fastly/compute-js-static-publish";
import { Config } from "../../src/types/config.js";
import RoutesCollection from "../../src/routing/RoutesCollection.js";
import AssetsCollection from "../../src/assets/AssetsCollection.js";
import RouteMatcher from "../../src/routing/RouteMatcher.js";
import { createRouteMatcherContext } from "../../src/routing/RouteMatcherContext.js";
import {
  HttpHeaders,
  RouterResult,
  RouterResultBase,
  RouterResultDest,
  RouterResultError,
  RouterResultFilesystem
} from "../../src/types/routing.js";
import { Holder } from "../../src/utils/misc.js";
import { deepStrictEqualNullProto } from "./assert.js";

export function loadRouteMatcher(fixtureRoot: string) {

  const fixtureAssets = loadFixtureAssets(path.resolve(fixtureRoot, 'output'));
  const { contentAssets, moduleAssets } = fixtureAssets;

  const configJsonAsset = contentAssets.getAsset('/config.json');
  if(configJsonAsset == null || configJsonAsset.type !== 'string') {
    throw new Error('Unable to load config.json');
  }

  const assetsCollection = new AssetsCollection(contentAssets, moduleAssets);
  const routesCollection = loadRoutesCollection(configJsonAsset.getText());
  const routeMatcher = new RouteMatcher(routesCollection);
  routeMatcher.onCheckFilesystem =
    pathname => assetsCollection.getAsset(pathname) != null;

  return routeMatcher;

}

export function loadRoutesCollection(configJson: string) {

  const config = JSON.parse(configJson) as Config;
  return new RoutesCollection(config.routes ?? []);

}

export function loadFixtureAssets(rootPath: string) {

  const contentAssetMap: ContentAssetMetadataMap = {};
  const moduleAssetMap: ModuleAssetMap = {};
  loadFixtureAssetsWorker(
    contentAssetMap,
    moduleAssetMap,
    rootPath,
    rootPath,
  );

  const contentAssets = new ContentAssets(contentAssetMap);
  const moduleAssets = new ModuleAssets(moduleAssetMap);
  return { contentAssets, moduleAssets };
}

function loadFixtureAssetsWorker(
  contentAssetMap: ContentAssetMetadataMap,
  moduleAssetMap: ModuleAssetMap,
  rootPath: string,
  itemPath: string,
) {

  if (!fs.existsSync(itemPath)) {
    return;
  }

  const stats = fs.statSync(itemPath);
  if (stats.isDirectory()) {
    // is a dir

    for (const dirEntry of fs.readdirSync(itemPath)) {
      loadFixtureAssetsWorker(
        contentAssetMap,
        moduleAssetMap,
        rootPath,
        path.resolve(itemPath, dirEntry),
      );
    }

  } else {
    // is a file

    let assetKey = itemPath.slice(rootPath.length);
    if (!assetKey.startsWith('/')) {
      assetKey = '/' + assetKey;
    }

    const contentTypeResult = testFileContentType(null, itemPath);
    if (contentTypeResult?.text) {

      contentAssetMap[assetKey] = {
        type: 'string',
        assetKey,
        contentType: contentTypeResult.contentType ?? 'text/plain',
        text: true,
        lastModifiedTime: 0,
        fileInfo: {
          content: fs.readFileSync(itemPath, 'utf-8'),
          size: 0,
          hash: '',
        },
        compressedFileInfos: {},
      };

      const isModule = (
        assetKey.startsWith('/functions/') &&
        (assetKey.endsWith('.js') || assetKey.endsWith('.mjs') || assetKey.endsWith('.cjs'))
      );

      if (isModule) {
        moduleAssetMap[assetKey] = {
          isStaticImport: false,
          loadModule: () => import(itemPath),
          module: undefined,
        };
      }

    } else {

      contentAssetMap[assetKey] = {
        type: 'bytes',
        assetKey,
        contentType: contentTypeResult?.contentType ?? 'application/octet-stream',
        text: false,
        lastModifiedTime: 0,
        fileInfo: {
          bytes: fs.readFileSync(itemPath),
          size: 0,
          hash: '',
        },
        compressedFileInfos: {},
      };

    }
  }
}

export type CheckRequest = {
  src: string,
};

export type CheckResultBase = {
  status?: number,
  headers?: HttpHeaders,
};

export type CheckResultDest = {
  dest?: string,
};

export type CheckResultFilesystem = CheckResultBase & CheckResultDest & {
  type: 'filesystem',
}

export type CheckResultError = CheckResultBase & {
  type: 'error',
}

export type CheckResult =
  CheckResultFilesystem | CheckResultError;

export type CheckItem = {
  name?: string;
  request: CheckRequest,
  result: CheckResult,
};

export type ChecksFile = {
  checks: CheckItem[],
};

export function loadChecksFile(dirname: string, filename: string = 'checks.json'): ChecksFile {
  const checksJsonFilepath = path.resolve(dirname, filename);
  const checksJsonContent = fs.readFileSync(checksJsonFilepath, 'utf-8');
  return JSON.parse(checksJsonContent) as ChecksFile;
}

function checkName(check: CheckItem) {
  return check.name ?? check.request?.src ?? JSON.stringify(check);
}

export function performChecks(routeMatcher: RouteMatcher, checksFile: ChecksFile) {

  for (const check of checksFile.checks) {

    const name = checkName(check);

    describe(name, function() {

      const routerResultHolder: Holder<RouterResult> = {};

      before(async function() {
        if (
          check.request?.src == null ||
          check.result?.type == null
        ) {
          this.skip();
          return;
        }

        const url = new URL(check.request.src, 'https://www.example.com/');
        const routeMatcherContext = createRouteMatcherContext(String(url));
        routerResultHolder.item = await routeMatcher.doRouter(routeMatcherContext);
        //console.log(routerResultHolder);
      });

      switch(check.result.type) {
      case 'filesystem': {
        assertFilesystemResult(routerResultHolder as Holder<RouterResultFilesystem>, check.result);
        break;
      }
      case 'error': {
        assertErrorResult(routerResultHolder as Holder<RouterResultError>, check.result);
        break;
      }
      }

    });

  }

}

function assertFilesystemResult(routerResultHolder: Holder<RouterResultFilesystem>, result: CheckResultFilesystem) {
  assertRouterResultType(routerResultHolder, result);
  assertRouterResultStatus(routerResultHolder, result);
  assertRouterResultDest(routerResultHolder, result);
  assertRouterResultHeaders(routerResultHolder, result);
}

function assertErrorResult(routerResultHolder: Holder<RouterResultError>, result: CheckResultError) {
  assertRouterResultType(routerResultHolder, result);
  assertRouterResultStatus(routerResultHolder, result);
  assertRouterResultHeaders(routerResultHolder, result);
}

function assertRouterResultType(routerResultHolder: Holder<RouterResult>, result: CheckResult) {
  it(`type ${result.type}`, function() {
    assert.strictEqual(routerResultHolder.item?.type, result.type);
  });
}

function assertRouterResultStatus(routerResultHolder: Holder<RouterResultBase>, result: CheckResultBase) {
  it(`status ${result.status}`, function() {
    assert.strictEqual(routerResultHolder.item?.status, result.status);
  });
}

function assertRouterResultDest(routerResultHolder: Holder<RouterResultDest>, result: CheckResultDest) {
  it(`dest ${result.dest}`, function() {
    assert.strictEqual(routerResultHolder.item?.dest, result.dest);
  });
}

function assertRouterResultHeaders(routerResultHolder: Holder<RouterResultBase>, result: CheckResultBase) {
  it(`headers`, function() {
    deepStrictEqualNullProto(routerResultHolder.item?.headers, result.headers);
  });
}

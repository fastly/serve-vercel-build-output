import assert from "assert";
import fs from "fs";
import path from "path";
import type { Asset, AssetsMap } from "@fastly/compute-js-static-publish";
import { defaultContentTypes, testFileContentType } from "@fastly/compute-js-static-publish/resources/default-content-types";
import { Config } from "../../src/types/config";
import RoutesCollection from "../../src/routing/RoutesCollection";
import AssetsCollection from "../../src/assets/AssetsCollection";
import RouteMatcher from "../../src/routing/RouteMatcher";
import { createRouteMatcherContext } from "../../src/routing/RouteMatcherContext";
import {
  HttpHeaders,
  RouterResult,
  RouterResultBase,
  RouterResultDest,
  RouterResultError,
  RouterResultFilesystem
} from "../../src/types/routing";
import { Holder } from "../../src/utils/misc";
import { deepStrictEqualNullProto } from "./assert";

export function loadRouteMatcher(fixtureRoot: string) {

  const fixtureAssets = loadFixtureAssets(path.resolve(fixtureRoot, 'output'));

  const configJsonAsset = fixtureAssets['/config.json'];
  if(configJsonAsset == null || configJsonAsset.type !== 'string') {
    throw new Error('Unable to load config.json');
  }

  const assetsCollection = new AssetsCollection(fixtureAssets);
  const routesCollection = loadRoutesCollection(configJsonAsset.content);
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
  const assetsMap: AssetsMap = {};
  loadFixtureAssetsWorker(
    assetsMap,
    rootPath,
    rootPath,
  );
  return assetsMap;
}

function moduleTest(path: string): boolean {
  if (path.startsWith('/functions/') &&
    (path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.cjs'))
  ) {
    return true;
  }
  return false;
}

function loadFixtureAssetsWorker(assetsMap: AssetsMap, rootPath: string, itemPath: string) {

  if (!fs.existsSync(itemPath)) {
    return;
  }

  const stats = fs.statSync(itemPath);
  if (stats.isDirectory()) {

    // is a dir
    for (const dirEntry of fs.readdirSync(itemPath)) {
      loadFixtureAssetsWorker(assetsMap, rootPath, path.resolve(itemPath, dirEntry));
    }

  } else {

    // is a file
    const contentTypeResult = testFileContentType(defaultContentTypes, itemPath);

    let assetKey = itemPath.slice(rootPath.length);
    if (!assetKey.startsWith('/')) {
      assetKey = '/' + assetKey;
    }

    let asset: Asset;

    if (contentTypeResult == null || contentTypeResult.binary) {

      asset = {
        type: 'binary',
        content: fs.readFileSync(itemPath),
        contentType: contentTypeResult?.type ?? 'application/octet-stream',
        module: null,
        loadModule: null,
        isStatic: false,
      };

    } else {

      asset = {
        type: 'string',
        content: fs.readFileSync(itemPath, 'utf-8'),
        contentType: contentTypeResult?.type ?? 'text/plain',
        module: null,
        loadModule: moduleTest(assetKey) ? () => import(itemPath) : null,
        isStatic: false,
      };

    }

    assetsMap[assetKey] = asset;
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

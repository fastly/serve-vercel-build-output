import fs from "fs";
import path from "path";
import type { Asset, AssetsMap } from "@fastly/compute-js-static-publish";
import { defaultContentTypes, testFileContentType } from "@fastly/compute-js-static-publish/resources/default-content-types";
import { Config } from "../../src/types/config";
import RoutesCollection from "../../src/routing/RoutesCollection";
import AssetsCollection from "../../src/assets/AssetsCollection";
import RouteMatcher from "../../src/routing/RouteMatcher";

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

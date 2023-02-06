// noinspection DuplicatedCode

import * as assert from 'assert';

import { RoutesCollection } from "../../src/routing/RoutesCollection";
import RouteMatcher from "../../src/routing/RouteMatcher";
import {RouteMatcherContext} from "../../src/routing/RouteMatcherContext";

describe('routing/RouteMatcher', function () {
  describe('RouteMatcher', function () {
    describe('constructing', function () {

      it('constructs', function() {

        const routesCollection = new RoutesCollection(null);

        const routeMatcher = new RouteMatcher(routesCollection);

        assert.strictEqual(routeMatcher._routesCollection, routesCollection);

      });

    });

    describe('checkFileSystem', function () {

      it('without onCheckFilesystem', async function () {

        const routesCollection = new RoutesCollection(null);
        const routeMatcher = new RouteMatcher(routesCollection);

        assert.ok(await routeMatcher.checkFilesystem('foo/bar'));

      });

      it('with onCheckFilesystem', async function () {

        const routesCollection = new RoutesCollection(null);
        const routeMatcher = new RouteMatcher(routesCollection);
        routeMatcher.onCheckFilesystem = (pathname) => {
          return pathname === 'foo/bar';
        };

        assert.ok(await routeMatcher.checkFilesystem('foo/bar'));
        assert.ok(!(await routeMatcher.checkFilesystem('foo/baz')));

      });

      it('with async onCheckFilesystem', async function () {

        const routesCollection = new RoutesCollection(null);
        const routeMatcher = new RouteMatcher(routesCollection);
        routeMatcher.onCheckFilesystem = async (pathname) => {
          return pathname === 'foo/bar';
        };

        assert.ok(await routeMatcher.checkFilesystem('foo/bar'));
        assert.ok(!(await routeMatcher.checkFilesystem('foo/baz')));

      });

    });

    describe('doMiddlewareFunction', function () {

      it('without onMiddleware', async function () {

        const routesCollection = new RoutesCollection(null);
        const routeMatcher = new RouteMatcher(routesCollection);

        const routeMatcherContext = RouteMatcherContext.fromUrl('https://www.example.com/')
        const middlewareResponse = await routeMatcher.doMiddlewareFunction('foo/bar', routeMatcherContext);

        assert.ok(middlewareResponse.isContinue);
        assert.strictEqual(middlewareResponse.status, undefined);
        assert.strictEqual(middlewareResponse.dest, undefined);
        assert.strictEqual(middlewareResponse.headers, undefined);
        assert.strictEqual(middlewareResponse.requestHeaders, undefined);
        assert.strictEqual(middlewareResponse.response, undefined);

      });

      it('with onMiddleware', async function () {

        const routesCollection = new RoutesCollection(null);
        const routeMatcher = new RouteMatcher(routesCollection);

        routeMatcher.onMiddleware = (middlewarePath, routeMatcherContext) => {
          assert.strictEqual(routeMatcherContext.url.toString(), 'https://www.example.com/');
          return {
            status: middlewarePath === 'foo/bar' ? 200 : 500,
            isContinue: false,
          };
        };

        const routeMatcherContext = RouteMatcherContext.fromUrl('https://www.example.com/')

        let result;
        result = await routeMatcher.doMiddlewareFunction('foo/bar', routeMatcherContext);
        assert.strictEqual(result.status, 200);

        result = await routeMatcher.doMiddlewareFunction('foo/baz', routeMatcherContext);
        assert.strictEqual(result.status, 500);


      });

      it('with async onMiddleware', async function () {

        const routesCollection = new RoutesCollection(null);
        const routeMatcher = new RouteMatcher(routesCollection);

        routeMatcher.onMiddleware = async (middlewarePath, routeMatcherContext) => {
          assert.strictEqual(routeMatcherContext.url.toString(), 'https://www.example.com/');
          return {
            status: middlewarePath === 'foo/bar' ? 200 : 500,
            isContinue: false,
          };
        };

        const routeMatcherContext = RouteMatcherContext.fromUrl('https://www.example.com/')

        let result;
        result = await routeMatcher.doMiddlewareFunction('foo/bar', routeMatcherContext);
        assert.strictEqual(result.status, 200);

        result = await routeMatcher.doMiddlewareFunction('foo/baz', routeMatcherContext);
        assert.strictEqual(result.status, 500);

      });

    });

    describe('initHeaders', function () {

      it('without onInitHeaders', async function () {

        const routesCollection = new RoutesCollection(null);
        const routeMatcher = new RouteMatcher(routesCollection);

        const headers = await routeMatcher.initHeaders();
        assert.deepStrictEqual(headers, {});

      });

      it('with onInitHeaders', async function () {

        const routesCollection = new RoutesCollection(null);
        const routeMatcher = new RouteMatcher(routesCollection);

        routeMatcher.onInitHeaders = () => {
          return {
            'foo': 'bar',
          };
        };

        const headers = await routeMatcher.initHeaders();
        assert.deepStrictEqual(headers, { 'foo': 'bar' });

      });

      it('with async onInitHeaders', async function () {

        const routesCollection = new RoutesCollection(null);
        const routeMatcher = new RouteMatcher(routesCollection);

        routeMatcher.onInitHeaders = async () => {
          return {
            'foo': 'bar',
          };
        };

        const headers = await routeMatcher.initHeaders();
        assert.deepStrictEqual(headers, { 'foo': 'bar' });

      });
    });

    describe('routeMainLoop', function() {
      // we only do simple cases here, we will be doing a lot of end-to-end in
      // integration tests

      // TODO: tests
    });
  });
});

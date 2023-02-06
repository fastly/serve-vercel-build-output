// noinspection DuplicatedCode

import * as assert from 'assert';

import { Route } from "@vercel/routing-utils";

import RoutesCollection from "../../src/routing/RoutesCollection";
import RouteMatcherContext from "../../src/routing/RouteMatcherContext";
import RouteMatcher from "../../src/routing/RouteMatcher";

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

    describe('doPhaseRoutes', function () {

      it('empty', async function() {

        const routesCollection = new RoutesCollection(null);
        const routeMatcher = new RouteMatcher(routesCollection);

        const routeMatcherContext = RouteMatcherContext.fromUrl('https://www.example.com/')

        const phaseRoutesResult = await routeMatcher.doPhaseRoutes(null, routeMatcherContext);

        assert.deepStrictEqual(phaseRoutesResult.phase, null);
        assert.deepStrictEqual(phaseRoutesResult.status, undefined);
        assert.deepStrictEqual(phaseRoutesResult.requestHeaders, undefined);
        assert.deepStrictEqual(phaseRoutesResult.headers, undefined);
        assert.deepStrictEqual(phaseRoutesResult.dest, '/');
        assert.deepStrictEqual(phaseRoutesResult.middlewareResponse, undefined);
        assert.deepStrictEqual(phaseRoutesResult.isDestUrl, false);
        assert.deepStrictEqual(phaseRoutesResult.isCheck, false);
        assert.deepStrictEqual(phaseRoutesResult.matchedEntries, []);
        assert.strictEqual(phaseRoutesResult.matchedRoute, undefined);

      });

      it('route result from specified phase', async function() {

        const routes: Route[] = [
          {
            src: '^/foo/$',
            dest: '/bar/',
          },
          {
            handle: 'filesystem'
          },
          {
            src: '^/foo/$',
            dest: '/baz/',
          },
          {
            src: '^/baz/$',
            headers: {
              'hoge': '$0',
            },
          },
        ];

        const routesCollection = new RoutesCollection(routes);
        const routeMatcher = new RouteMatcher(routesCollection);

        const routeMatcherContext = RouteMatcherContext.fromUrl('https://www.example.com/foo/')

        const phaseRoutesResult = await routeMatcher.doPhaseRoutes('filesystem', routeMatcherContext);

        assert.deepStrictEqual(phaseRoutesResult.phase, 'filesystem');
        assert.deepStrictEqual(phaseRoutesResult.status, undefined);
        assert.deepStrictEqual(phaseRoutesResult.requestHeaders, undefined);
        assert.deepStrictEqual(phaseRoutesResult.headers, undefined);
        assert.deepStrictEqual(phaseRoutesResult.dest, '/baz/');
        assert.deepStrictEqual(phaseRoutesResult.middlewareResponse, undefined);
        assert.deepStrictEqual(phaseRoutesResult.isDestUrl, false);
        assert.deepStrictEqual(phaseRoutesResult.isCheck, false);
        assert.deepStrictEqual(phaseRoutesResult.matchedEntries, [
          {
            phase: 'filesystem',
            src: '/foo/',
            route: routes[2],
            routeIndex: 0,
            isContinue: false,
            status: undefined,
            headers: undefined,
            requestHeaders: undefined,
            dest: {
              originalValue: '/baz/',
              finalValue: '/baz/',
              replacementTokens: undefined,
            },
            middlewarePath: undefined,
            middlewareResponse: undefined,
            isDestUrl: false,
            isCheck: false,
          },
        ]);
        assert.strictEqual(phaseRoutesResult.matchedRoute, routes[2]);
      });

      it('continue checks next route as well', async function() {

        const routes: Route[] = [
          {
            src: '^/foo/$',
            dest: '/bar/',
          },
          {
            handle: 'filesystem'
          },
          {
            src: '^/foo/$',
            dest: '/baz/',
            continue: true,
          },
          {
            src: '^/(.*?)/?$',
            headers: {
              'hoge': '$1',
            },
          },
        ];

        const routesCollection = new RoutesCollection(routes);
        const routeMatcher = new RouteMatcher(routesCollection);

        const routeMatcherContext = RouteMatcherContext.fromUrl('https://www.example.com/foo/')

        const phaseRoutesResult = await routeMatcher.doPhaseRoutes('filesystem', routeMatcherContext);

        assert.deepStrictEqual(phaseRoutesResult.phase, 'filesystem');
        assert.deepStrictEqual(phaseRoutesResult.status, undefined);
        assert.deepStrictEqual(phaseRoutesResult.requestHeaders, undefined);
        assert.deepStrictEqual(phaseRoutesResult.headers, {
          'hoge': 'baz'
        });
        assert.deepStrictEqual(phaseRoutesResult.dest, '/baz/');
        assert.deepStrictEqual(phaseRoutesResult.middlewareResponse, undefined);
        assert.deepStrictEqual(phaseRoutesResult.isDestUrl, false);
        assert.deepStrictEqual(phaseRoutesResult.isCheck, false);
        assert.deepStrictEqual(phaseRoutesResult.matchedEntries, [
          {
            phase: 'filesystem',
            src: '/foo/',
            route: routes[2],
            routeIndex: 0,
            isContinue: true,
            status: undefined,
            headers: undefined,
            requestHeaders: undefined,
            dest: {
              originalValue: '/baz/',
              finalValue: '/baz/',
              replacementTokens: undefined,
            },
            middlewarePath: undefined,
            middlewareResponse: undefined,
            isDestUrl: false,
            isCheck: false,
          },
          {
            phase: 'filesystem',
            src: '/baz/',
            route: routes[3],
            routeIndex: 1,
            isContinue: false,
            status: undefined,
            headers: {
              'hoge': {
                originalValue: '$1',
                finalValue: 'baz',
                replacementTokens: {
                  '$1': 'baz'
                },
              },
            },
            requestHeaders: undefined,
            dest: undefined,
            middlewarePath: undefined,
            middlewareResponse: undefined,
            isDestUrl: false,
            isCheck: false,
          },
        ]);
        assert.strictEqual(phaseRoutesResult.matchedRoute, routes[3]);
      });

      it('continue on final route means no match', async function() {

        const routes: Route[] = [
          {
            src: '^/foo/$',
            dest: '/bar/',
          },
          {
            handle: 'filesystem'
          },
          {
            src: '^/foo/$',
            dest: '/baz/',
            continue: true,
          },
        ];

        const routesCollection = new RoutesCollection(routes);
        const routeMatcher = new RouteMatcher(routesCollection);

        const routeMatcherContext = RouteMatcherContext.fromUrl('https://www.example.com/foo/')

        const phaseRoutesResult = await routeMatcher.doPhaseRoutes('filesystem', routeMatcherContext);

        assert.deepStrictEqual(phaseRoutesResult.phase, 'filesystem');
        assert.deepStrictEqual(phaseRoutesResult.status, undefined);
        assert.deepStrictEqual(phaseRoutesResult.requestHeaders, undefined);
        assert.deepStrictEqual(phaseRoutesResult.headers, undefined);
        assert.deepStrictEqual(phaseRoutesResult.dest, '/baz/');
        assert.deepStrictEqual(phaseRoutesResult.middlewareResponse, undefined);
        assert.deepStrictEqual(phaseRoutesResult.isDestUrl, false);
        assert.deepStrictEqual(phaseRoutesResult.isCheck, false);
        assert.deepStrictEqual(phaseRoutesResult.matchedEntries, [
          {
            phase: 'filesystem',
            src: '/foo/',
            route: routes[2],
            routeIndex: 0,
            isContinue: true,
            status: undefined,
            headers: undefined,
            requestHeaders: undefined,
            dest: {
              originalValue: '/baz/',
              finalValue: '/baz/',
              replacementTokens: undefined,
            },
            middlewarePath: undefined,
            middlewareResponse: undefined,
            isDestUrl: false,
            isCheck: false,
          },
        ]);
        assert.strictEqual(phaseRoutesResult.matchedRoute, undefined);
      });
    });
  });
});

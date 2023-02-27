// noinspection DuplicatedCode
/// <reference types='@fastly/js-compute' />

import * as assert from 'assert';
import { Route } from "@vercel/routing-utils";

import { deepStrictEqualNullProto } from "../test_utils/assert";
import RoutesCollection from "../../src/routing/RoutesCollection";
import RouteMatcher from "../../src/routing/RouteMatcher";
import { requestToRouteMatcherContext } from "../../src/routing/RouteMatcherContext";

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

        assert.ok(!(await routeMatcher.checkFilesystem('foo/bar')));

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

        const routeMatcherContext = requestToRouteMatcherContext(new Request( 'https://www.example.com/' ))
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
          assert.strictEqual(routeMatcherContext.host, 'www.example.com');
          assert.strictEqual(routeMatcherContext.pathname, '/');
          deepStrictEqualNullProto(routeMatcherContext.query, {});
          return {
            status: middlewarePath === 'foo/bar' ? 200 : 500,
            isContinue: false,
          };
        };

        const routeMatcherContext = requestToRouteMatcherContext(new Request( 'https://www.example.com/' ))

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
          assert.strictEqual(routeMatcherContext.host, 'www.example.com');
          assert.strictEqual(routeMatcherContext.pathname, '/');
          deepStrictEqualNullProto(routeMatcherContext.query, {});
          return {
            status: middlewarePath === 'foo/bar' ? 200 : 500,
            isContinue: false,
          };
        };

        const routeMatcherContext = requestToRouteMatcherContext(new Request( 'https://www.example.com/' ))

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

    describe('doRouter', function() {
      // we only do simple cases here, we will be doing a lot of end-to-end in
      // integration tests

      it('initHeaders', async function() {

        const routesCollection = new RoutesCollection(null);
        const routeMatcher = new RouteMatcher(routesCollection);
        routeMatcher.onInitHeaders = () => {
          return {
            'foo': 'bar',
          };
        };

        const routeMatcherContext = requestToRouteMatcherContext(new Request( 'https://www.example.com/foo/bar' ))

        const routerResult = await routeMatcher.doRouter(routeMatcherContext);

        assert.deepStrictEqual(routerResult.phaseResults!.filter(x => x.matchedRoute != null), []);
        assert.strictEqual(routerResult.status, 500);
        assert.deepStrictEqual(routerResult.headers, {
          'foo': 'bar',
        });
        assert.ok(routerResult.type === 'error');
      });

      it('filesystem result', async function () {
        const routesCollection = new RoutesCollection(null);
        const routeMatcher = new RouteMatcher(routesCollection);
        routeMatcher.onCheckFilesystem = (pathname) => {
          return pathname === '/foo/bar';
        };

        const routeMatcherContext = requestToRouteMatcherContext(new Request( 'https://www.example.com/foo/bar' ))

        const routerResult = await routeMatcher.doRouter(routeMatcherContext);

        assert.deepStrictEqual(routerResult.phaseResults!.filter(x => x.matchedRoute != null), []);
        assert.strictEqual(routerResult.status, undefined);
        assert.deepStrictEqual(routerResult.headers, {});
        assert.ok(routerResult.type === 'filesystem');
        assert.strictEqual(routerResult.dest, '/foo/bar');
      });

      it('middleware result', async function () {
        const routes = [
          {
            src: '^/foo/bar$',
            middlewarePath: 'middleware-id'
          }
        ];
        const routesCollection = new RoutesCollection(routes);
        const routeMatcher = new RouteMatcher(routesCollection);
        const response = new Response(
          'foo-body',
          {
            status: 201,
            headers: {
              'foo-header': 'bar-header',
            },
          }
        );
        routeMatcher.onMiddleware = (middlewarePath) => {
          assert.strictEqual(middlewarePath, 'middleware-id');
          return {
            status: 200,
            headers: {
              'foo': 'bar',
            },
            isContinue: false,
            response,
          };
        }

        const routeMatcherContext = requestToRouteMatcherContext(new Request( 'https://www.example.com/foo/bar' ))

        const routerResult = await routeMatcher.doRouter(routeMatcherContext);

        assert.deepStrictEqual(routerResult.phaseResults!.filter(x => x.matchedRoute != null), [
          {
            phase: null,
            status: 200,
            headers: {
              'foo': 'bar',
            },
            dest: '/foo/bar',
            middlewareResponse: response,
            isDestUrl: false,
            isCheck: false,
            matchedEntries: [
              {
                phase: null,
                src: '/foo/bar',
                route: routes[0],
                routeIndex: 0,
                isContinue: false,
                status: 200,
                headers: {
                  'foo': {
                    originalValue: 'bar',
                    finalValue: 'bar',
                  },
                },
                requestHeaders: undefined,
                dest: undefined,
                middlewarePath: 'middleware-id',
                middlewareResponse: response,
                isDestUrl: false,
                isCheck: false,
              },
            ],
            matchedRoute: routes[0],
          }
        ]);
        assert.strictEqual(routerResult.status, 200);
        assert.deepStrictEqual(routerResult.headers, {
          'foo': 'bar',
        });
        assert.ok(routerResult.type === 'middleware');
        assert.strictEqual(routerResult.middlewareResponse, response);
      });

      it('proxy result', async function () {
        const routes = [
          {
            src: '^/foo/bar$',
            dest: 'https://www.example.com/baz'
          }
        ];
        const routesCollection = new RoutesCollection(routes);
        const routeMatcher = new RouteMatcher(routesCollection);

        const routeMatcherContext = requestToRouteMatcherContext(new Request( 'https://www.example.com/foo/bar' ))

        const routerResult = await routeMatcher.doRouter(routeMatcherContext);

        assert.deepStrictEqual(routerResult.phaseResults!.filter(x => x.matchedRoute != null), [
          {
            phase: null,
            dest: 'https://www.example.com/baz',
            isDestUrl: true,
            isCheck: false,
            matchedEntries: [
              {
                phase: null,
                src: '/foo/bar',
                route: routes[0],
                routeIndex: 0,
                isContinue: false,
                status: undefined,
                headers: undefined,
                requestHeaders: undefined,
                dest: {
                  originalValue: 'https://www.example.com/baz',
                  finalValue: 'https://www.example.com/baz',
                },
                middlewarePath: undefined,
                middlewareResponse: undefined,
                isDestUrl: true,
                isCheck: false,
              },
            ],
            matchedRoute: routes[0],
          }
        ]);
        assert.strictEqual(routerResult.status, undefined);
        assert.deepStrictEqual(routerResult.headers, {});
        assert.ok(routerResult.type === 'proxy');
        assert.strictEqual(routerResult.dest, 'https://www.example.com/baz');
      });
    });

    describe('doPhaseRoutes', function () {

      it('empty', async function() {

        const routesCollection = new RoutesCollection(null);
        const routeMatcher = new RouteMatcher(routesCollection);

        const routeMatcherContext = requestToRouteMatcherContext(new Request( 'https://www.example.com/' ))

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
            src: '^/foo$',
            dest: '/bar',
          },
          {
            handle: 'filesystem'
          },
          {
            src: '^/foo$',
            dest: '/baz',
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

        const routeMatcherContext = requestToRouteMatcherContext(new Request( 'https://www.example.com/foo' ))

        const phaseRoutesResult = await routeMatcher.doPhaseRoutes('filesystem', routeMatcherContext);

        assert.deepStrictEqual(phaseRoutesResult.phase, 'filesystem');
        assert.deepStrictEqual(phaseRoutesResult.status, undefined);
        assert.deepStrictEqual(phaseRoutesResult.requestHeaders, undefined);
        assert.deepStrictEqual(phaseRoutesResult.headers, undefined);
        assert.deepStrictEqual(phaseRoutesResult.dest, '/baz');
        assert.deepStrictEqual(phaseRoutesResult.middlewareResponse, undefined);
        assert.deepStrictEqual(phaseRoutesResult.isDestUrl, false);
        assert.deepStrictEqual(phaseRoutesResult.isCheck, false);
        assert.deepStrictEqual(phaseRoutesResult.matchedEntries, [
          {
            phase: 'filesystem',
            src: '/foo',
            route: routes[2],
            routeIndex: 0,
            isContinue: false,
            status: undefined,
            headers: undefined,
            requestHeaders: undefined,
            dest: {
              originalValue: '/baz',
              finalValue: '/baz',
            },
            middlewarePath: undefined,
            middlewareResponse: undefined,
            isDestUrl: false,
            isCheck: false,
          },
        ]);
        assert.deepStrictEqual(phaseRoutesResult.matchedRoute, routes[2]);
      });

      it('continue will continue to next route', async function() {

        const routes: Route[] = [
          {
            src: '^/foo$',
            dest: '/bar',
          },
          {
            handle: 'filesystem'
          },
          {
            src: '^/foo$',
            dest: '/baz',
            continue: true,
          },
          {
            src: '^/(.*)$',
            headers: {
              'hoge': '$1',
            },
          },
        ];

        const routesCollection = new RoutesCollection(routes);
        const routeMatcher = new RouteMatcher(routesCollection);

        const routeMatcherContext = requestToRouteMatcherContext(new Request( 'https://www.example.com/foo' ))

        const phaseRoutesResult = await routeMatcher.doPhaseRoutes('filesystem', routeMatcherContext);

        assert.deepStrictEqual(phaseRoutesResult.phase, 'filesystem');
        assert.deepStrictEqual(phaseRoutesResult.status, undefined);
        assert.deepStrictEqual(phaseRoutesResult.requestHeaders, undefined);
        assert.deepStrictEqual(phaseRoutesResult.headers, {
          'hoge': 'baz'
        });
        assert.deepStrictEqual(phaseRoutesResult.dest, '/baz');
        assert.deepStrictEqual(phaseRoutesResult.middlewareResponse, undefined);
        assert.deepStrictEqual(phaseRoutesResult.isDestUrl, false);
        assert.deepStrictEqual(phaseRoutesResult.isCheck, false);
        assert.deepStrictEqual(phaseRoutesResult.matchedEntries, [
          {
            phase: 'filesystem',
            src: '/foo',
            route: routes[2],
            routeIndex: 0,
            isContinue: true,
            status: undefined,
            headers: undefined,
            requestHeaders: undefined,
            dest: {
              originalValue: '/baz',
              finalValue: '/baz',
            },
            middlewarePath: undefined,
            middlewareResponse: undefined,
            isDestUrl: false,
            isCheck: false,
          },
          {
            phase: 'filesystem',
            src: '/baz',
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
        assert.deepStrictEqual(phaseRoutesResult.matchedRoute, routes[3]);
      });

      it('middleware that returns next', async function() {

        const routes: Route[] = [
          {
            src: '^/foo$',
            middlewarePath: 'middleware-id',
          },
          {
            src: '^/foo$',
            dest: '/baz',
          },
        ];

        const routesCollection = new RoutesCollection(routes);
        const routeMatcher = new RouteMatcher(routesCollection);
        routeMatcher.onMiddleware = (middlewarePath) => {
          assert.strictEqual(middlewarePath, 'middleware-id');
          return {
            isContinue: true,
          };
        };

        const routeMatcherContext = requestToRouteMatcherContext(new Request( 'https://www.example.com/foo' ))

        const phaseRoutesResult = await routeMatcher.doPhaseRoutes(null, routeMatcherContext);

        assert.deepStrictEqual(phaseRoutesResult.phase, null);
        assert.deepStrictEqual(phaseRoutesResult.status, undefined);
        assert.deepStrictEqual(phaseRoutesResult.requestHeaders, undefined);
        assert.deepStrictEqual(phaseRoutesResult.headers, undefined);
        assert.deepStrictEqual(phaseRoutesResult.dest, '/baz');
        assert.deepStrictEqual(phaseRoutesResult.middlewareResponse, undefined);
        assert.deepStrictEqual(phaseRoutesResult.isDestUrl, false);
        assert.deepStrictEqual(phaseRoutesResult.isCheck, false);

        assert.deepStrictEqual(phaseRoutesResult.matchedEntries, [
          {
            phase: null,
            src: '/foo',
            route: routes[0],
            routeIndex: 0,
            isContinue: true,
            status: undefined,
            headers: undefined,
            requestHeaders: undefined,
            dest: undefined,
            middlewarePath: 'middleware-id',
            middlewareResponse: undefined,
            isDestUrl: false,
            isCheck: false,
          },
          {
            phase: null,
            src: '/foo',
            route: routes[1],
            routeIndex: 1,
            isContinue: false,
            status: undefined,
            headers: undefined,
            requestHeaders: undefined,
            dest: {
              originalValue: '/baz',
              finalValue: '/baz',
            },
            middlewarePath: undefined,
            middlewareResponse: undefined,
            isDestUrl: false,
            isCheck: false,
          },
        ]);
        assert.deepStrictEqual(phaseRoutesResult.matchedRoute, routes[1]);
      });

      it('middleware with dest and next', async function() {

        const routes: Route[] = [
          {
            src: '^/foo$',
            middlewarePath: 'middleware-id',
          },
          {
            src: '^/bar$',
            dest: '/baz',
          },
        ];

        const routesCollection = new RoutesCollection(routes);
        const routeMatcher = new RouteMatcher(routesCollection);
        routeMatcher.onMiddleware = (middlewarePath) => {
          assert.strictEqual(middlewarePath, 'middleware-id');
          return {
            dest: '/bar',
            isContinue: true,
          };
        };

        const routeMatcherContext = requestToRouteMatcherContext(new Request( 'https://www.example.com/foo' ))

        const phaseRoutesResult = await routeMatcher.doPhaseRoutes(null, routeMatcherContext);

        assert.deepStrictEqual(phaseRoutesResult.phase, null);
        assert.deepStrictEqual(phaseRoutesResult.status, undefined);
        assert.deepStrictEqual(phaseRoutesResult.requestHeaders, undefined);
        assert.deepStrictEqual(phaseRoutesResult.headers, undefined);
        assert.deepStrictEqual(phaseRoutesResult.dest, '/baz');
        assert.deepStrictEqual(phaseRoutesResult.middlewareResponse, undefined);
        assert.deepStrictEqual(phaseRoutesResult.isDestUrl, false);
        assert.deepStrictEqual(phaseRoutesResult.isCheck, false);

        assert.deepStrictEqual(phaseRoutesResult.matchedEntries, [
          {
            phase: null,
            src: '/foo',
            route: routes[0],
            routeIndex: 0,
            isContinue: true,
            status: undefined,
            headers: undefined,
            requestHeaders: undefined,
            dest: {
              originalValue: '/bar',
              finalValue: '/bar',
            },
            middlewarePath: 'middleware-id',
            middlewareResponse: undefined,
            isDestUrl: false,
            isCheck: false,
          },
          {
            phase: null,
            src: '/bar',
            route: routes[1],
            routeIndex: 1,
            isContinue: false,
            status: undefined,
            headers: undefined,
            requestHeaders: undefined,
            dest: {
              originalValue: '/baz',
              finalValue: '/baz',
            },
            middlewarePath: undefined,
            middlewareResponse: undefined,
            isDestUrl: false,
            isCheck: false,
          },
        ]);
        assert.deepStrictEqual(phaseRoutesResult.matchedRoute, routes[1]);
      });

      it('middleware with dest only', async function() {

        const routes: Route[] = [
          {
            src: '^/foo$',
            middlewarePath: 'middleware-id',
          },
          {
            src: '^/bar',
            dest: '/baz',
          },
        ];

        const routesCollection = new RoutesCollection(routes);
        const routeMatcher = new RouteMatcher(routesCollection);
        routeMatcher.onMiddleware = (middlewarePath) => {
          assert.strictEqual(middlewarePath, 'middleware-id');
          return {
            dest: '/bar',
            isContinue: false,
          };
        };

        const routeMatcherContext = requestToRouteMatcherContext(new Request( 'https://www.example.com/foo' ))

        const phaseRoutesResult = await routeMatcher.doPhaseRoutes(null, routeMatcherContext);

        assert.deepStrictEqual(phaseRoutesResult.phase, null);
        assert.deepStrictEqual(phaseRoutesResult.status, undefined);
        assert.deepStrictEqual(phaseRoutesResult.requestHeaders, undefined);
        assert.deepStrictEqual(phaseRoutesResult.headers, undefined);
        assert.deepStrictEqual(phaseRoutesResult.dest, '/bar');
        assert.deepStrictEqual(phaseRoutesResult.middlewareResponse, undefined);
        assert.deepStrictEqual(phaseRoutesResult.isDestUrl, false);
        assert.deepStrictEqual(phaseRoutesResult.isCheck, false);

        assert.deepStrictEqual(phaseRoutesResult.matchedEntries, [
          {
            phase: null,
            src: '/foo',
            route: routes[0],
            routeIndex: 0,
            isContinue: false,
            status: undefined,
            headers: undefined,
            requestHeaders: undefined,
            dest: {
              originalValue: '/bar',
              finalValue: '/bar',
            },
            middlewarePath: 'middleware-id',
            middlewareResponse: undefined,
            isDestUrl: false,
            isCheck: false,
          },
        ]);
        assert.deepStrictEqual(phaseRoutesResult.matchedRoute, routes[0]);
      });

      it('continue on final route means no match', async function() {

        const routes: Route[] = [
          {
            src: '^/foo$',
            dest: '/bar',
          },
          {
            handle: 'filesystem'
          },
          {
            src: '^/foo$',
            dest: '/baz',
            continue: true,
          },
        ];

        const routesCollection = new RoutesCollection(routes);
        const routeMatcher = new RouteMatcher(routesCollection);

        const routeMatcherContext = requestToRouteMatcherContext(new Request( 'https://www.example.com/foo' ))

        const phaseRoutesResult = await routeMatcher.doPhaseRoutes('filesystem', routeMatcherContext);

        assert.deepStrictEqual(phaseRoutesResult.phase, 'filesystem');
        assert.deepStrictEqual(phaseRoutesResult.status, undefined);
        assert.deepStrictEqual(phaseRoutesResult.requestHeaders, undefined);
        assert.deepStrictEqual(phaseRoutesResult.headers, undefined);
        assert.deepStrictEqual(phaseRoutesResult.dest, '/baz');
        assert.deepStrictEqual(phaseRoutesResult.middlewareResponse, undefined);
        assert.deepStrictEqual(phaseRoutesResult.isDestUrl, false);
        assert.deepStrictEqual(phaseRoutesResult.isCheck, false);
        assert.deepStrictEqual(phaseRoutesResult.matchedEntries, [
          {
            phase: 'filesystem',
            src: '/foo',
            route: routes[2],
            routeIndex: 0,
            isContinue: true,
            status: undefined,
            headers: undefined,
            requestHeaders: undefined,
            dest: {
              originalValue: '/baz',
              finalValue: '/baz',
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

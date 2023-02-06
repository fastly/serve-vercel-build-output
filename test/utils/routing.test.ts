// noinspection DuplicatedCode

import * as assert from "assert";

import { RouteWithSrc } from "@vercel/routing-utils";
import {
  resolveRouteParameters,
  flattenValuesAndReplacements,
  flattenValuesAndReplacementsObject,
  isURL,
  matchRoute,
  testRoute,
} from "../../src/utils/routing";
import { RouteMatcherContext } from "../../src/routing/RouteMatcherContext";

describe('utils/routing', function() {
  describe('resolveRouteParameters', function () {
    // TODO: tests
  });

  describe('flattenValuesAndReplacements', function () {
    // TODO: tests
  });

  describe('flattenValuesAndReplacementsObject', function () {
    // TODO: tests
  });

  describe('testRoute', function() {
    describe('match route src', function() {

      it('trailing slash', function() {

        const route: RouteWithSrc = {
          src: '^(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))/$',
        };

        let result;
        result = testRoute(route, RouteMatcherContext.fromUrl( 'https://www.example.com/foo/' ));
        assert.ok(result);

        result = testRoute(route, RouteMatcherContext.fromUrl( 'https://www.example.com/' ));
        assert.ok(!result);

        result = testRoute(route, RouteMatcherContext.fromUrl( 'https://www.example.com/foo' ));
        assert.ok(!result);

      });

      it('with replacements', function() {

        const route: RouteWithSrc = {
          src: '^[/]?(?<nextLocale>en\\-US|fr|nl\\-NL)?/routing/dynamic/catchall/(?<args>.+?)(?:/)?$',
          dest: '/$nextLocale/routing/dynamic/catchall/[...args]?args=$args'
        };

        let result1 = testRoute(route, RouteMatcherContext.fromUrl( 'https://www.example.com/foo/' ));
        assert.ok(!result1);

        const result2 = testRoute(route, RouteMatcherContext.fromUrl( 'https://www.example.com/fr/routing/dynamic/catchall/foo' ));
        assert.ok(result2);

        const { keys, match } = result2;
        const valuesAndReplacements = resolveRouteParameters(route.dest!, match, keys);
        assert.strictEqual(valuesAndReplacements.finalValue, '/fr/routing/dynamic/catchall/[...args]?args=foo');
      });

    });

    describe('method', function() {

      it('not specified', function() {

        const route: RouteWithSrc = {
          src: '^/$',
        };

        let result;
        result = testRoute(route, RouteMatcherContext.fromUrl( 'https://www.example.com/' ));
        assert.ok(result);

        result = testRoute(route, RouteMatcherContext.fromUrl( 'https://www.example.com/', { method: 'POST' } ));
        assert.ok(result);

      });

      it('specified', function() {

        const route: RouteWithSrc = {
          src: '^/$',
          methods: [ 'GET' ],
        };

        let result;
        result = testRoute(route, RouteMatcherContext.fromUrl( 'https://www.example.com/' ));
        assert.ok(result);

        result = testRoute(route, RouteMatcherContext.fromUrl( 'https://www.example.com/', { method: 'POST' } ));
        assert.ok(!result);

      });

    });

    describe('has header', function() {

      it('not specified', function() {

        const route: RouteWithSrc = {
          src: '^/$',
        };

        let result;
        result = testRoute(route, RouteMatcherContext.fromUrl( 'https://www.example.com/' ));
        assert.ok(result);

        result = testRoute(route, RouteMatcherContext.fromUrl( 'https://www.example.com/', { method: 'POST', headers: { 'x-nextjs-data': 'foo' }  } ));
        assert.ok(result);

      });

      it('specified', function() {

        const route: RouteWithSrc = {
          src: '^/$',
          has: [
            {
              type: 'header',
              key: 'x-nextjs-data'
            }
          ],
        };

        let result;
        result = testRoute(route, RouteMatcherContext.fromUrl( 'https://www.example.com/' ));
        assert.ok(!result);

        result = testRoute(route, RouteMatcherContext.fromUrl( 'https://www.example.com/', { method: 'POST', headers: { 'x-nextjs-data': 'foo' } } ));
        assert.ok(result);

      });

      it('value specified', function() {

        const route: RouteWithSrc = {
          src: '^/$',
          has: [
            {
              type: 'header',
              key: 'x-nextjs-data',
              value: 'foo',
            }
          ],
        };

        let result;
        result = testRoute(route, RouteMatcherContext.fromUrl( 'https://www.example.com/' ));
        assert.ok(!result);

        result = testRoute(route, RouteMatcherContext.fromUrl( 'https://www.example.com/', { method: 'POST', headers: { 'x-nextjs-data': 'foo' } } ));
        assert.ok(result);

        result = testRoute(route, RouteMatcherContext.fromUrl( 'https://www.example.com/', { method: 'POST', headers: { 'x-nextjs-data': 'bar' } } ));
        assert.ok(!result);

      });

    });

    // TODO: more tests

  });

  describe('applyRouteResults', function() {

    // TODO: more tests
  });

  describe('isURL', function() {
    it('tests if full URL', function() {
      let result;

      result = isURL('/foo');
      assert.ok(!result);

      result = isURL('/foo/bar');
      assert.ok(!result);

      result = isURL('https://www.example.com/foo/bar');
      assert.ok(result);
    });
  });

  describe('matchRoute', function() {

    it('failed testRoute should return false', async function () {

      const route: RouteWithSrc = {
        src: '^/$'
      };

      const matchResult = await matchRoute(
        null,
        0,
        route,
        RouteMatcherContext.fromUrl('https://www.example.com/foo'),
      );

      assert.ok(!matchResult);

    });

    it('middleware should get called', async function () {

      const route: RouteWithSrc = {
        src: '^/foo/$',
        middlewarePath: 'middleware-id'
      };

      let middlewarePathCalled: string | undefined;

      const response = new Response(null);

      const matchResult = await matchRoute(
        null,
        0,
        route,
        RouteMatcherContext.fromUrl('https://www.example.com/foo/'),
        (middlewarePath) => {
          middlewarePathCalled = middlewarePath;
          return {
            status: 201,
            dest: '/bar',
            headers: {
              'foo': 'bar',
            },
            requestHeaders: {
              'hoge': 'piyo',
            },
            response,
            isContinue: false,
          };
        }
      );

      assert.ok(matchResult);
      assert.strictEqual(matchResult.phase, null);
      assert.strictEqual(matchResult.src, '/foo/');
      assert.strictEqual(matchResult.routeIndex, 0);
      assert.strictEqual(matchResult.route, route);
      assert.ok(!matchResult.isContinue);
      assert.strictEqual(matchResult.status, 201);
      assert.deepStrictEqual(flattenValuesAndReplacementsObject(matchResult.headers!), {
        'foo': 'bar',
      });
      assert.deepStrictEqual(matchResult.requestHeaders, {
        'hoge': 'piyo',
      });
      assert.deepStrictEqual(flattenValuesAndReplacements(matchResult.dest!), '/bar' );
      assert.ok(!matchResult.isDestUrl);
      assert.ok(!matchResult.isCheck);
      assert.strictEqual(matchResult.middlewarePath, 'middleware-id');
      assert.strictEqual(matchResult.middlewareResponse, response);

    });

    it('middleware won\'t get called for non-null phase', async function () {

      const route: RouteWithSrc = {
        src: '^/foo/$',
        middlewarePath: 'middleware-id'
      };

      let middlewarePathCalled: string | undefined;

      const response = new Response(null);

      const matchResult = await matchRoute(
        'filesystem',
        0,
        route,
        RouteMatcherContext.fromUrl('https://www.example.com/foo/'),
        (middlewarePath) => {
          middlewarePathCalled = middlewarePath;
          return {
            status: 201,
            dest: '/bar',
            headers: {
              'foo': 'bar',
            },
            requestHeaders: {
              'hoge': 'piyo',
            },
            response,
            isContinue: false,
          };
        }
      );

      assert.ok(matchResult);
      assert.strictEqual(matchResult.phase, 'filesystem');
      assert.strictEqual(matchResult.src, '/foo/');
      assert.strictEqual(matchResult.routeIndex, 0);
      assert.strictEqual(matchResult.route, route);
      assert.ok(!matchResult.isContinue);
      assert.strictEqual(matchResult.status, undefined);
      assert.deepStrictEqual(matchResult.headers, undefined);
      assert.deepStrictEqual(matchResult.requestHeaders, undefined);
      assert.deepStrictEqual(matchResult.dest, undefined);
      assert.ok(!matchResult.isDestUrl);
      assert.ok(!matchResult.isCheck);
      assert.strictEqual(matchResult.middlewarePath, undefined);
      assert.strictEqual(matchResult.middlewareResponse, undefined);

    });

  });

});


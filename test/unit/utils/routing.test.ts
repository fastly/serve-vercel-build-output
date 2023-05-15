// noinspection DuplicatedCode
/// <reference types='@fastly/js-compute' />

import * as assert from "assert";

import { RouteWithSrc } from "@vercel/routing-utils";

import {
  resolveRouteParameters,
  isURL,
  testRoute,
} from "../../../src/server/utils/routing.js";
import { createRouteMatcherContext } from "../../../src/server/routing/RouteMatcherContext.js";

describe('utils/routing', function() {
  describe('resolveRouteParameters', function () {
    // TODO: tests
  });

  describe('testRoute', function() {
    describe('match route src', function() {

      it('trailing slash', function() {

        const route: RouteWithSrc = {
          src: '^(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))/$',
        };

        ;

        let result;
        result = testRoute(route, createRouteMatcherContext( 'https://www.example.com/foo/' ));
        assert.ok(result);

        result = testRoute(route, createRouteMatcherContext( 'https://www.example.com/' ));
        assert.ok(!result);

        result = testRoute(route, createRouteMatcherContext( 'https://www.example.com/foo' ));
        assert.ok(!result);

      });

      it('with replacements', function() {

        const route: RouteWithSrc = {
          src: '^[/]?(?<nextLocale>en\\-US|fr|nl\\-NL)?/routing/dynamic/catchall/(?<args>.+?)(?:/)?$',
          dest: '/$nextLocale/routing/dynamic/catchall/[...args]?args=$args'
        };

        let result1 = testRoute(route, createRouteMatcherContext( 'https://www.example.com/foo/' ));
        assert.ok(!result1);

        const result2 = testRoute(route, createRouteMatcherContext( 'https://www.example.com/fr/routing/dynamic/catchall/foo' ));
        assert.ok(result2);

        const { keys, match } = result2;
        const resolved = resolveRouteParameters(route.dest!, match, keys);
        assert.strictEqual(resolved, '/fr/routing/dynamic/catchall/[...args]?args=foo');
      });

    });

    describe('method', function() {

      it('not specified', function() {

        const route: RouteWithSrc = {
          src: '^/$',
        };

        let result;
        result = testRoute(route, createRouteMatcherContext( 'https://www.example.com/' ));
        assert.ok(result);

        result = testRoute(route, createRouteMatcherContext( 'https://www.example.com/', { method: 'POST' } ));
        assert.ok(result);

      });

      it('specified', function() {

        const route: RouteWithSrc = {
          src: '^/$',
          methods: [ 'GET' ],
        };

        let result;
        result = testRoute(route, createRouteMatcherContext( 'https://www.example.com/' ));
        assert.ok(result);

        result = testRoute(route, createRouteMatcherContext( 'https://www.example.com/', { method: 'POST' } ));
        assert.ok(!result);

      });

    });

    describe('has header', function() {

      it('not specified', function() {

        const route: RouteWithSrc = {
          src: '^/$',
        };

        let result;
        result = testRoute(route, createRouteMatcherContext( 'https://www.example.com/' ));
        assert.ok(result);

        result = testRoute(route, createRouteMatcherContext( 'https://www.example.com/', { method: 'POST', headers: { 'x-nextjs-data': 'foo' }  } ));
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
        result = testRoute(route, createRouteMatcherContext( 'https://www.example.com/' ));
        assert.ok(!result);

        result = testRoute(route, createRouteMatcherContext( 'https://www.example.com/', { method: 'POST', headers: { 'x-nextjs-data': 'foo' } } ));
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
        result = testRoute(route, createRouteMatcherContext( 'https://www.example.com/' ));
        assert.ok(!result);

        result = testRoute(route, createRouteMatcherContext( 'https://www.example.com/', { method: 'POST', headers: { 'x-nextjs-data': 'foo' } } ));
        assert.ok(result);

        result = testRoute(route, createRouteMatcherContext( 'https://www.example.com/', { method: 'POST', headers: { 'x-nextjs-data': 'bar' } } ));
        assert.ok(!result);

      });

    });

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



});


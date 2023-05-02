// noinspection DuplicatedCode
/// <reference types='@fastly/js-compute' />

import * as assert from 'assert';

import {
  requestToRouteMatcherContext,
  RouteMatcherContext,
  routeMatcherContextToRequest
} from '../../../src/server/routing/RouteMatcherContext.js';
import { headersToObject } from "../../../src/server/utils/query.js";
import { deepStrictEqualNullProto } from "../../test_utils/assert.js";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

describe('routing/RouteMatcherContext', function() {
  describe('RouteMatcherContext', function () {
    describe('requestToRouteMatcherContext', function() {

      it('from Request', async function() {

        const request = new Request(
          'https://www.example.com/path/to/resource',
        );

        const routeMatcherContext = requestToRouteMatcherContext(request);

        assert.strictEqual(routeMatcherContext.method, 'GET');
        assert.strictEqual(routeMatcherContext.pathname, '/path/to/resource');
        deepStrictEqualNullProto(routeMatcherContext.query, {});
        deepStrictEqualNullProto(routeMatcherContext.headers, {});

        const body = await routeMatcherContext.body;
        assert.strictEqual(body, null);

      });

      it('from Request with headers', async function() {

        const request = new Request(
          'https://www.example.com/',
          {
            headers: {
              'foo': 'bar',
              'content-type': 'text/plain;charset=UTF-8',
            },
          }
        );

        const routeMatcherContext = requestToRouteMatcherContext(request);

        assert.strictEqual(routeMatcherContext.method, 'GET');
        assert.strictEqual(routeMatcherContext.pathname, '/');
        deepStrictEqualNullProto(routeMatcherContext.query, {});
        deepStrictEqualNullProto(routeMatcherContext.headers, {
          'foo': 'bar',
          'content-type': 'text/plain;charset=UTF-8',
        });

        const body = await routeMatcherContext.body;
        assert.strictEqual(body, null);

      });

      it('from Request, with query', async function() {

        const request = new Request(
          'https://www.example.com/?foo=bar',
        );

        const routeMatcherContext = requestToRouteMatcherContext(request);

        assert.strictEqual(routeMatcherContext.method, 'GET');
        assert.strictEqual(routeMatcherContext.pathname, '/');
        deepStrictEqualNullProto(routeMatcherContext.query, {
          'foo': [ 'bar' ],
        });
        deepStrictEqualNullProto(routeMatcherContext.headers, {});

        const body = await routeMatcherContext.body;
        assert.strictEqual(body, null);

      });

      it('from Request, with body', async function() {

        const request = new Request(
          'https://www.example.com/',
          {
            method: 'POST',
            body: 'baz',
          }
        );

        const routeMatcherContext = requestToRouteMatcherContext(request);

        assert.strictEqual(routeMatcherContext.method, 'POST');
        assert.strictEqual(routeMatcherContext.pathname, '/');
        deepStrictEqualNullProto(routeMatcherContext.query, {});

        // POST will add this header automatically
        deepStrictEqualNullProto(routeMatcherContext.headers, {
          'content-type': 'text/plain;charset=UTF-8',
        });

        const body = await routeMatcherContext.body;

        assert.ok(body instanceof Uint8Array);
        assert.strictEqual(
          decoder.decode(body),
          'baz'
        );

      });

      it('doesn\'t consume the body from the Request', async function() {
        const request = new Request(
          'https://www.example.com/',
          {
            method: 'POST',
            body: 'baz',
          }
        );

        const routeMatcherContext = requestToRouteMatcherContext(request);

        // This will consume the body in the route matcher context,
        // but should not touch the body of the original request
        const contextBody = await routeMatcherContext.body;
        assert.ok(contextBody instanceof Uint8Array);

        const requestBody = request.body;
        assert.ok(requestBody instanceof ReadableStream<Uint8Array>);

        const requestText = await request.text();
        assert.strictEqual(requestText, 'baz');
      });

    });

    describe('routeMatcherContextToRequest', function() {

      it('with pathname only', function() {

        const context: RouteMatcherContext = {
          method: 'GET',
          host: 'www.example.com',
          pathname: '/path/to/resource',
          query: {},
          headers: {},
          cookies: {},
          dest: '',
          body: null,
        };
        const request = routeMatcherContextToRequest(context);

        assert.strictEqual(request.method, 'GET');
        assert.strictEqual(String(request.url), 'https://www.example.com/path/to/resource');
        deepStrictEqualNullProto(headersToObject(request.headers), {});
        assert.strictEqual(request.body, null);

      });

      it('with headers', function() {

        const context: RouteMatcherContext = {
          method: 'GET',
          host: 'www.example.com',
          pathname: '/',
          query: {},
          headers: {
            'foo': 'bar',
            'content-type': 'text/plain;charset=UTF-8',
          },
          cookies: {},
          dest: '',
          body: null,
        };
        const request = routeMatcherContextToRequest(context);

        assert.strictEqual(request.method, 'GET');
        assert.strictEqual(String(request.url), 'https://www.example.com/');
        deepStrictEqualNullProto(headersToObject(request.headers), {
          'foo': 'bar',
          'content-type': 'text/plain;charset=UTF-8',
        });
        assert.strictEqual(request.body, null);

      });

      it('with query', function() {

        const context: RouteMatcherContext = {
          method: 'GET',
          host: 'www.example.com',
          pathname: '/path/to/resource',
          query: { 'foo': [ 'bar' ] },
          headers: {},
          cookies: {},
          dest: '',
          body: null,
        };
        const request = routeMatcherContextToRequest(context);

        assert.strictEqual(request.method, 'GET');
        assert.strictEqual(String(request.url), 'https://www.example.com/path/to/resource?foo=bar');
        assert.strictEqual(request.body, null);

      });

      it('with method and body', async function() {

        const context: RouteMatcherContext = {
          method: 'POST',
          host: 'www.example.com',
          pathname: '/',
          query: {},
          headers: {},
          cookies: {},
          dest: '',
          body: Promise.resolve(encoder.encode('foo')),
        };
        const request = routeMatcherContextToRequest(context);

        assert.strictEqual(request.method, 'POST');
        assert.strictEqual(String(request.url), 'https://www.example.com/');

        assert.ok(request.body instanceof ReadableStream<Uint8Array>);
        assert.strictEqual(await request.text(), 'foo');

      });

    });
  });
});

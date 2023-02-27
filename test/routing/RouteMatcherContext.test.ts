// noinspection DuplicatedCode
/// <reference types='@fastly/js-compute' />

import * as assert from 'assert';

import RouteMatcherContext_, {
  requestToRouteMatcherContext,
  RouteMatcherContext,
  routeMatcherContextToRequest
} from '../../src/routing/RouteMatcherContext';
import { headersToObject } from "../../src/utils/query";
import { readableStreamToArray } from "../../src/utils/stream";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

describe('routing/RouteMatcherContext', function() {
  describe.only('RouteMatcherContext', function () {
    describe('requestToRouteMatcherContext', function() {

      it('from Request', async function() {

        const request = new Request(
          'https://www.example.com/path/to/resource',
        );

        const routeMatcherContext = requestToRouteMatcherContext(request);

        assert.strictEqual(routeMatcherContext.method, 'GET');
        assert.strictEqual(routeMatcherContext.pathname, '/path/to/resource');
        assert.strictEqual(routeMatcherContext.query, '');
        assert.deepStrictEqual(routeMatcherContext.headers, {});

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
        assert.strictEqual(routeMatcherContext.query, '');
        assert.deepStrictEqual(routeMatcherContext.headers, {
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
        assert.strictEqual(routeMatcherContext.query, '?foo=bar');
        assert.deepStrictEqual(routeMatcherContext.headers, {});

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
        assert.strictEqual(routeMatcherContext.query, '');

        // POST will add this header automatically
        assert.deepStrictEqual(routeMatcherContext.headers, {
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
          pathname: '/path/to/resource',
          query: '',
          headers: {},
          body: null,
        };
        const request = routeMatcherContextToRequest(context, 'https://www.example.com/');

        assert.strictEqual(request.method, 'GET');
        assert.strictEqual(String(request.url), 'https://www.example.com/path/to/resource');
        assert.deepStrictEqual(headersToObject(request.headers), {});
        assert.strictEqual(request.body, null);

      });

      it('with headers', function() {

        const context: RouteMatcherContext = {
          method: 'GET',
          pathname: '/',
          query: '',
          headers: {
            'foo': 'bar',
            'content-type': 'text/plain;charset=UTF-8',
          },
          body: null,
        };
        const request = routeMatcherContextToRequest(context, 'https://www.example.com/');

        assert.strictEqual(request.method, 'GET');
        assert.strictEqual(String(request.url), 'https://www.example.com/');
        assert.deepStrictEqual(headersToObject(request.headers), {
          'foo': 'bar',
          'content-type': 'text/plain;charset=UTF-8',
        });
        assert.strictEqual(request.body, null);

      });

      it('with query', function() {

        const context: RouteMatcherContext = {
          method: 'GET',
          pathname: '/path/to/resource',
          query: '?foo=bar',
          headers: {},
          body: null,
        };
        const request = routeMatcherContextToRequest(context, 'https://www.example.com/');

        assert.strictEqual(request.method, 'GET');
        assert.strictEqual(String(request.url), 'https://www.example.com/path/to/resource?foo=bar');
        assert.strictEqual(request.body, null);

      });

      it('with method and body', async function() {

        const context: RouteMatcherContext = {
          method: 'POST',
          pathname: '/',
          query: '',
          headers: {},
          body: Promise.resolve(encoder.encode('foo')),
        };
        const request = routeMatcherContextToRequest(context, 'https://www.example.com/');

        assert.strictEqual(request.method, 'POST');
        assert.strictEqual(String(request.url), 'https://www.example.com/');

        assert.ok(request.body instanceof ReadableStream<Uint8Array>);
        assert.strictEqual(await request.text(), 'foo');

      });

    });

    describe('constructing', function() {
      it('constructor call', function () {

        const headers = {};
        const body = {} as BodyInit;

        const routeMatcherContext = new RouteMatcherContext_({
          method: 'foo',
          headers,
          url: 'https://www.example.com/',
          body,
        });

        assert.strictEqual(routeMatcherContext.method, 'foo');
        assert.strictEqual(routeMatcherContext.headers, headers);
        assert.strictEqual(routeMatcherContext.url.toString(), 'https://www.example.com/');
        assert.strictEqual(routeMatcherContext.body, body);

      });

      it('new instance from Request', async function() {

        const request = new Request(
          'https://www.example.com/',
          {
            method: 'POST',
            headers: {
              'foo': 'bar',
              'content-type': 'text/plain;charset=UTF-8',
            },
            body: 'baz',
          }
        );

        const routeMatcherContext = RouteMatcherContext_.fromRequest(request);

        assert.strictEqual(routeMatcherContext.method, 'POST');
        assert.deepStrictEqual(routeMatcherContext.headers, {
          'foo': 'bar',
          'content-type': 'text/plain;charset=UTF-8',
        });
        assert.strictEqual(routeMatcherContext.url.toString(), 'https://www.example.com/');

        assert.ok(routeMatcherContext.body instanceof ReadableStream<Uint8Array>);
        assert.strictEqual(
          decoder.decode(
            await readableStreamToArray(routeMatcherContext.body)
          ),
          'baz'
        );

      });

      it('new instance from URL (with no method or headers)', async function() {

        const routeMatcherContext = RouteMatcherContext_.fromUrl('https://www.example.com/');

        assert.strictEqual(routeMatcherContext.method, 'GET');
        assert.deepStrictEqual(routeMatcherContext.headers, {});
        assert.strictEqual(routeMatcherContext.url.toString(), 'https://www.example.com/');
        assert.strictEqual(routeMatcherContext.body, null);

      });

      it('new instance from URL (with POST and body)', async function() {

        const routeMatcherContext = RouteMatcherContext_.fromUrl(
          'https://www.example.com/',
          {
            method: 'POST',
            body: 'baz',
          }
        );

        assert.strictEqual(routeMatcherContext.method, 'POST');
        assert.deepStrictEqual(routeMatcherContext.headers, {});
        assert.strictEqual(routeMatcherContext.url.toString(), 'https://www.example.com/');
        assert.strictEqual(routeMatcherContext.body, 'baz');

      });

      it('new instance from URL (with headers)', async function() {

        const routeMatcherContext = RouteMatcherContext_.fromUrl(
          'https://www.example.com/',
          {
            headers: {
              'foo': 'bar',
            },
          }
        );

        assert.strictEqual(routeMatcherContext.method, 'GET');
        assert.deepStrictEqual(routeMatcherContext.headers, { 'foo': 'bar' });
        assert.strictEqual(routeMatcherContext.url.toString(), 'https://www.example.com/');
        assert.strictEqual(routeMatcherContext.body, null);

      });
    });

    describe('toRequest', function() {
      it('default builder', async function () {

        const routeMatcherContext = new RouteMatcherContext_({
          method: 'POST',
          headers: {
            'foo': 'bar',
            'content-type': 'text/plain;charset=UTF-8',
          },
          url: 'https://www.example.com/',
          body: 'baz',
        });

        const request = routeMatcherContext.toRequest();

        assert.strictEqual(request.method, 'POST');
        assert.deepStrictEqual(
          headersToObject(request.headers),
          {
            'foo': 'bar',
            'content-type': 'text/plain;charset=UTF-8',
          }
        );
        assert.strictEqual(request.url, 'https://www.example.com/');
        assert.ok(request.body instanceof ReadableStream<Uint8Array>);
        assert.strictEqual(
          decoder.decode(
            await readableStreamToArray(request.body)
          ),
          'baz'
        );

      });
    });
  });
});

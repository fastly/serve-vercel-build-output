// noinspection DuplicatedCode
/// <reference types='@fastly/js-compute' />

import * as assert from 'assert';

import RouteMatcherContext, { defaultRequestBuilder } from '../../src/routing/RouteMatcherContext';
import { headersToObject } from "../../src/utils/query";

const decoder = new TextDecoder();

async function streamToArrayBuffer(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  let result = new Uint8Array(0);
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const newResult = new Uint8Array(result.length + value.length);
    newResult.set(result);
    newResult.set(value, result.length);
    result = newResult;
  }
  return result;
}

describe('routing/RouteMatcherContext', function() {
  describe('defaultRequestBuilder', function() {

    it('creates an instance of Request', function() {

      const request = defaultRequestBuilder('https://www.example.com/');

      assert.ok(request instanceof Request);
      assert.strictEqual(request.url, 'https://www.example.com/');

    });

  });

  describe('RouteMatcherContext', function () {
    describe('constructing', function() {
      it('constructor call', function () {

        const headers = {};
        const body = {} as BodyInit;

        const routeMatcherContext = new RouteMatcherContext({
          method: 'foo',
          headers,
          url: 'https://www.example.com/',
          body,
        });

        assert.strictEqual(routeMatcherContext.getContext(), undefined);
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

        const routeMatcherContext = RouteMatcherContext.fromRequest(request);

        assert.strictEqual(routeMatcherContext.getContext(), undefined);
        assert.strictEqual(routeMatcherContext.method, 'POST');
        assert.deepStrictEqual(routeMatcherContext.headers, {
          'foo': 'bar',
          'content-type': 'text/plain;charset=UTF-8',
        });
        assert.strictEqual(routeMatcherContext.url.toString(), 'https://www.example.com/');

        assert.ok(routeMatcherContext.body instanceof ReadableStream<Uint8Array>);
        assert.strictEqual(
          decoder.decode(
            await streamToArrayBuffer(routeMatcherContext.body)
          ),
          'baz'
        );

      });

      it('new instance from URL (with no method or headers)', async function() {

        const routeMatcherContext = RouteMatcherContext.fromUrl('https://www.example.com/');

        assert.strictEqual(routeMatcherContext.getContext(), undefined);
        assert.strictEqual(routeMatcherContext.method, 'GET');
        assert.deepStrictEqual(routeMatcherContext.headers, {});
        assert.strictEqual(routeMatcherContext.url.toString(), 'https://www.example.com/');
        assert.strictEqual(routeMatcherContext.body, null);

      });

      it('new instance from URL (with POST and body)', async function() {

        const routeMatcherContext = RouteMatcherContext.fromUrl(
          'https://www.example.com/',
          {
            method: 'POST',
            body: 'baz',
          }
        );

        assert.strictEqual(routeMatcherContext.getContext(), undefined);
        assert.strictEqual(routeMatcherContext.method, 'POST');
        assert.deepStrictEqual(routeMatcherContext.headers, {});
        assert.strictEqual(routeMatcherContext.url.toString(), 'https://www.example.com/');
        assert.strictEqual(routeMatcherContext.body, 'baz');

      });

      it('new instance from URL (with headers)', async function() {

        const routeMatcherContext = RouteMatcherContext.fromUrl(
          'https://www.example.com/',
          {
            headers: {
              'foo': 'bar',
            },
          }
        );

        assert.strictEqual(routeMatcherContext.getContext(), undefined);
        assert.strictEqual(routeMatcherContext.method, 'GET');
        assert.deepStrictEqual(routeMatcherContext.headers, { 'foo': 'bar' });
        assert.strictEqual(routeMatcherContext.url.toString(), 'https://www.example.com/');
        assert.strictEqual(routeMatcherContext.body, null);

      });
    });

    describe('context', function() {
      it('can set context', function() {

        type X = {
          foo: string;
        };

        const obj: X = { foo: 'bar' };

        const routeMatcherContext = RouteMatcherContext.fromUrl('https://www.example.com/');
        routeMatcherContext.setContext(obj);
        assert.strictEqual(routeMatcherContext.getContext<X>(), obj);

      });
    });

    describe('toRequest', function() {
      it('default builder', async function () {

        const routeMatcherContext = new RouteMatcherContext({
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
            await streamToArrayBuffer(request.body)
          ),
          'baz'
        );

      });
    });
  });
});

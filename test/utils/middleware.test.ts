// noinspection DuplicatedCode
/// <reference types='@fastly/js-compute' />

import * as assert from 'assert';

import { processMiddlewareResponse } from "../../src/utils/middleware";

describe('utils/middleware', function() {
  describe('processMiddlewareResponse', function() {

    it('Empty response', function() {

      const response = new Response(null);

      const middlewareResponse = processMiddlewareResponse(response, 'http://localhost/');

      assert.strictEqual(middlewareResponse.response, response);
      assert.strictEqual(middlewareResponse.status, 200);
      assert.strictEqual(middlewareResponse.dest, undefined);
      assert.strictEqual(middlewareResponse.headers, undefined);
      assert.strictEqual(middlewareResponse.requestHeaders, undefined);
      assert.ok(!middlewareResponse.isContinue);

    });

    it('Response with next', function() {

      const response = new Response(null, {
        headers: {
          'x-middleware-next': '1'
        }
      });

      const middlewareResponse = processMiddlewareResponse(response, 'http://localhost/');

      assert.strictEqual(middlewareResponse.response, undefined);
      assert.ok(middlewareResponse.isContinue);
      assert.strictEqual(middlewareResponse.status, undefined);

    });

    it('Response with next and status code other than 200', function() {

      const response = new Response(null, {
        status: 400,
        headers: {
          'x-middleware-next': '1'
        },
      });

      const middlewareResponse = processMiddlewareResponse(response, 'http://localhost/');

      assert.strictEqual(middlewareResponse.response, undefined);
      assert.ok(middlewareResponse.isContinue);
      assert.strictEqual(middlewareResponse.status, 400);

    });

    it('Response with Location header', function() {

      const response = new Response(null, {
        headers: {
          'Location': 'https://www.google.com/',
        },
        status: 307,
      });

      const middlewareResponse = processMiddlewareResponse(response, 'http://localhost/');

      assert.strictEqual(middlewareResponse.response, undefined);
      assert.ok(!middlewareResponse.isContinue);
      assert.strictEqual(middlewareResponse.status, 307);
      assert.strictEqual(middlewareResponse.headers?.['location'], 'https://www.google.com/');

    });

    it('Response with rewrite', function() {

      const response = new Response(null, {
        headers: {
          'x-middleware-rewrite': 'https://www.google.com/',
        },
      });

      const middlewareResponse = processMiddlewareResponse(response, 'http://localhost/');

      assert.strictEqual(middlewareResponse.response, undefined);
      assert.ok(!middlewareResponse.isContinue);
      assert.strictEqual(middlewareResponse.dest, 'https://www.google.com/');

    });

    it('Response with rewrite (relative)', function() {

      const response = new Response(null, {
        headers: {
          'x-middleware-rewrite': 'http://localhost/blog2',
        },
      });

      const middlewareResponse = processMiddlewareResponse(response, 'http://localhost/blog1');

      assert.strictEqual(middlewareResponse.response, undefined);
      assert.ok(!middlewareResponse.isContinue);
      assert.strictEqual(middlewareResponse.dest, '/blog2');

    });

    it('Response with request headers', function() {

      const response = new Response(null, {
        headers: {
          'x-middleware-next': '1',
          'x-middleware-override-headers': 'key-1,key-2',
          'x-middleware-request-key-1': 'value-1',
          'x-middleware-request-key-2': 'value-2',
          'x-middleware-request-key-3': 'value-3',
        },
      });

      const middlewareResponse = processMiddlewareResponse(response, 'http://localhost/');

      assert.strictEqual(middlewareResponse.response, undefined);
      assert.ok(middlewareResponse.isContinue);

      assert.deepStrictEqual(middlewareResponse.requestHeaders, { 'key-1': 'value-1', 'key-2': 'value-2' });

      // This one should be left, because it wasn't specified in x-middleware-override-headers
      assert.deepStrictEqual(middlewareResponse.headers, { 'x-middleware-request-key-3': 'value-3' });

    });



  });
});

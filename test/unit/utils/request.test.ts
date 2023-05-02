// noinspection DuplicatedCode
/// <reference types='@fastly/js-compute' />

import * as assert from "assert";

import { generateRequestId } from "../../../src/server/utils/request.js";

describe('utils/request', function() {
  describe('generateRequestId', function() {
    it('with no invoke', function() {
      const requestId = generateRequestId('podId');

      const [ podId, date, bytes, none ] = requestId.split('-');

      assert.strictEqual(podId, 'dev1::podId');
      assert.ok(parseInt(date, 10));
      assert.strictEqual(bytes.length, 12);
      assert.strictEqual(none, undefined);
    });
  });
});

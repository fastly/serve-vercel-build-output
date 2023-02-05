import * as assert from 'assert';
import { headersToObject } from "../../src/utils/query";

describe('utils/query', function() {
  describe('headersToObject', function() {
    it('Empty headers', function() {

      const headers = new Headers();
      const headersObject = headersToObject(headers);

      assert.deepStrictEqual(headersObject, {});

    });

    // TODO: more testing here
  });
});

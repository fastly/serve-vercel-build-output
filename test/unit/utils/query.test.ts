// noinspection DuplicatedCode
/// <reference types='@fastly/js-compute' />

import * as assert from 'assert';

import { headersToObject } from "../../../src/utils/query";
import {deepStrictEqualNullProto} from "../../test_utils/assert";

describe('utils/query', function() {
  describe('headersToObject', function() {
    it('Empty headers', function() {

      const headers = new Headers();
      const headersObject = headersToObject(headers);

      deepStrictEqualNullProto(headersObject, {});

    });

    // TODO: more testing here
  });
});

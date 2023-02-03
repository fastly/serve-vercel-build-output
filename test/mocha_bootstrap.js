/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

// Restores the default sandbox after every test
exports.mochaHooks = {
  beforeEach() {
    onBeforeEach();
  },
  afterEach() {
    onAfterEach();
  },
};

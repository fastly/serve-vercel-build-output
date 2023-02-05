/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

const crypto = require('node:crypto').webcrypto;

exports.mochaGlobalSetup = () => {
  globalThis.crypto = crypto;
};

// Restores the default sandbox after every test
exports.mochaHooks = {
  beforeEach() {
    onBeforeEach();
  },
  afterEach() {
    onAfterEach();
  },
};

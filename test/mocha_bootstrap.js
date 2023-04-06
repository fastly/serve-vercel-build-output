/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

import { webcrypto as crypto } from 'node:crypto';

export const mochaGlobalSetup = () => {
  globalThis.crypto = crypto;
};

// Restores the default sandbox after every test
export const mochaHooks = {
  beforeEach() {
    onBeforeEach();
  },
  afterEach() {
    onAfterEach();
  },
};

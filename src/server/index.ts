/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

/// <reference types='@fastly/js-compute' />

export * from './logging/index.js';
export * from './utils/index.js';
export * from './server/index.js';
export * from './types/public.js';

import VercelBuildOutputServer from './server/VercelBuildOutputServer.js';
export default VercelBuildOutputServer;

/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

/// <reference types='@fastly/js-compute' />

export * from './logging/index';
export * from './utils/index';
export * from './server/index';

import { VercelBuildOutputServer } from './server/index';
export default VercelBuildOutputServer;

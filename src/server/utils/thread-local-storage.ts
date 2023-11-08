/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

// "Thread Local" Storage
//
// This simulates "thread local" storage by allowing to save or retrieve an object
// tagged by a string label.
//
// NOTE: This isn't a "real" implementation of Thread Local. However, Compute provides
// its own working space to each request, so everything here can be considered "local" to
// the current "thread" of execution.

const __values: Record<string, any> = {};

export function getThreadLocal<T>(tag: string): T | undefined {
  return __values[tag] as T;
}

export function setThreadLocal<T>(tag: string, value: T) {
  __values[tag] = value;
}

/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

// This function allows to hook the global "fetch" function with a handler to examine the
// inputs, and perform an alternative implementation.
//
// The handler is expected to return either a Promise that resolves to a Response object, or
// null.
//
// If it returns null, then this indicates that no alternative handling has been done, and
// the original fetch function is called with the same inputs.

export type OnBeforeFetchHandler = (
  fetch: typeof globalThis.fetch,
  input: Parameters<typeof globalThis.fetch>[0],
  init: Parameters<typeof globalThis.fetch>[1]
) => ReturnType<typeof fetch> | null;

export function onBeforeFetch(handler: OnBeforeFetchHandler) {

  const origFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init) => {
    return handler(origFetch, input, init) ?? origFetch(input, init);
  };

}

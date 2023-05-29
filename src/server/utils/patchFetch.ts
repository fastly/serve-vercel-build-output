/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

export type OnBeforeFetchHandler = (
  fetch: typeof globalThis.fetch,
  input: Parameters<typeof globalThis.fetch>[0],
  init: Parameters<typeof globalThis.fetch>[1]
) => ReturnType<typeof fetch> | null;

export function onBeforeFetch(handler: OnBeforeFetchHandler) {

  const origFetch = fetch.bind(globalThis);
  globalThis.fetch = (input, init) => {
    return handler(origFetch, input, init) ?? origFetch(input, init);
  };

}

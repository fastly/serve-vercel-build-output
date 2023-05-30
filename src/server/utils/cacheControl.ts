/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

export type CacheControlValue = {
  isPublic?: boolean,
  sMaxAge?: number,
  staleWhileRevalidate?: number,
};

export function parseCacheControl(value: string | undefined): CacheControlValue | undefined {

  if (value == null) {
    return undefined;
  }

  const cacheControlValue: CacheControlValue = {};

  for (const segment of value.split(',')) {
    const [ segKey, segValue ] = segment.split('=').map(x => x.trim());
    switch(segKey.toLowerCase()) {
      case 'public':
        cacheControlValue.isPublic = true;
        break;
      case 'max-age':
        if (segValue != null) {
          const secs = parseInt(segValue, 10);
          if (secs !== 0) {
            cacheControlValue.sMaxAge = secs;
          }
        }
        break;
      case 's-maxage':
        cacheControlValue.isPublic = true;
        if (segValue != null) {
          const secs = parseInt(segValue, 10);
          if (secs !== 0) {
            cacheControlValue.sMaxAge = secs;
          }
        }
        break;
      case 'stale-while-revalidate':
        let staleWhileRevalidate = 0;
        if (segValue != null) {
          staleWhileRevalidate = parseInt(segValue, 10);
        }
        cacheControlValue.staleWhileRevalidate = staleWhileRevalidate;
        break;
      default:
        console.log('Unprocessed segment: ', segment);
    }
  }

  return cacheControlValue;

}

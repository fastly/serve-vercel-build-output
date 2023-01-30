import type { Route } from '@vercel/routing-utils';

declare type ImageFormat = 'image/avif' | 'image/webp';
export declare type RemotePattern = {
  /**
   * Must be `http` or `https`.
   */
  protocol?: 'http' | 'https';
  /**
   * Can be literal or wildcard.
   * Single `*` matches a single subdomain.
   * Double `**` matches any number of subdomains.
   */
  hostname: string;
  /**
   * Can be literal port such as `8080` or empty string
   * meaning no port.
   */
  port?: string;
  /**
   * Can be literal or wildcard.
   * Single `*` matches a single path segment.
   * Double `**` matches any number of path segments.
   */
  pathname?: string;
};

export interface Images {
  domains: string[];
  remotePatterns?: RemotePattern[];
  sizes: number[];
  minimumCacheTTL?: number;
  formats?: ImageFormat[];
  dangerouslyAllowSVG?: boolean;
  contentSecurityPolicy?: string;
}

interface WildcardEntry {
  domain: string;
  value: string;
}
export interface PathOverride {
  contentType?: string;
  path?: string;
}

export type Config = {
  version: 3,
  routes?: Route[],
  images?: Images,
  wildcard?: WildcardEntry[],
  overrides?: Record<string, PathOverride>,
}

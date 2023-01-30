import { HandleValue, RouteWithSrc } from "@vercel/routing-utils";
import type { PromiseOrValue } from "../utils/misc.js";

// Types related to routing

// Entire set of HTTP headers, as a JavaScript object.
// Each key maps to its value. Multiple values in a single header is listed
// // as a single string, as comma-separated values.
// e.g.: "Content-Type: application/json" and "Accept-Encoding: br, gzip"
// would be encoded as
// {
//   'Content-Type': 'application/json',
//   'Accept-Encoding': 'br, gzip'
// }
// Note this also includes Cookies.

export type HttpHeaders = Record<string, string>;

// Entire set of HTTP Cookies, as a JavaScript object.
// Each key maps to its value.
// e.g.: "cookie_name1=cookie_value1; cookie_name2=cookie_value2"
// would be encoded as
// {
//   cookie_name1: 'cookie_value1',
//   cookie_name2: 'cookie_value2',
// }
export type HttpCookies = Record<string, string>;

// Entire set of query parameters, as a JavaScript object.
// Each key maps to an array of all values.
// e.g.: foo=bar&foo=baz&hi=ho
// would be represented as
// {
//   foo: [ 'bar', 'baz' ],
//   hi: 'ho',
// }
export type QueryParams = Record<string, string[]>;

// Data to temporarily save the state, so that we can restore it later
export type RouteMatcherContextState = {
  pathname: string;
  query: QueryParams;
};

// Route Matching Context object holds:
// * request `method`, `pathname`, (request) `headers`, `query`, `cookie`, `body`
// * result `status` and (response) `headers`.
// `dest` can be written to, and will update `pathname` and `query` accordingly.
export interface RouteMatcherContext {

  // The method of the request, in uppercase
  readonly method: string;

  // The host header of the request
  readonly host: string;

  // The pathname of the request, including the initial slash
  readonly pathname: string;

  // The query part of the request
  readonly query: QueryParams;

  // HTTP Headers of the request
  readonly headers: HttpHeaders;

  // Set header on request
  // Currently only done in special cases, such as by Middleware
  setRequestHeader(key: string, value: string): void;

  // Cookies of the request, as key-value pairs.
  readonly cookies: HttpCookies;

  // Body of the request, if not GET or HEAD
  readonly body: Promise<Uint8Array> | null;

  // Status code of the response
  readonly status: number | undefined;

  // Set status code of response
  setStatus(value: number): void;

  // Response HTTP headers
  readonly responseHeaders: HttpHeaders;

  // Set header on response
  // Unless 'replace' is true, this will not overwrite existing header keys
  setResponseHeader(key: string, value: string, replace: boolean): void;

  // Set `pathname` and merge `query`
  setDest(value: string): void;

  // Save the current state so that it can be restored later
  getState(): RouteMatcherContextState;

  // Reset `pathname` and `query`
  restoreState(state: RouteMatcherContextState): void;
}

export type PhaseName = HandleValue | 'main' | null;

// Result of finding a match in a router phase
// Usually returned by doRouterPhase
export type RouterPhaseResult = {
  // The phase that the route matching was performed in
  phase: PhaseName,

  // The route that was matched
  matchedRoute: RouteWithSrc | undefined,

  // The integer index of the route matched in the group
  routeIndex: number | undefined,

  // Type of router result
  type: 'redirect' | 'proxy' | 'dest' | 'synthetic' | 'error',

  // Effective status value of the route, if any
  status?: number,

  // Response headers of the route, if any
  headers?: HttpHeaders,

  // Effective dest value of the route
  dest?: string,

  // Effective check value of the route
  isCheck?: boolean,

  // Effective response, if it should be returned
  response?: Response,

  // For 'rewrite' phase, return a copy of dest from before the phase
  originalDest?: string,

  // Replacement Tokens stringified, for dest mode
  routeMatches?: string,
};

export type ApplyRouteResultApplied = {
  type: 'applied',
  response: Response,
};

export type ApplyRouteResultError = {
  type: 'error',
  status?: number,
  errorCode?: string,
};

export type ApplyRouteResultSkipped = {
  type: 'skipped',
};

export type ApplyRouteResult =
  | ApplyRouteResultApplied
  | ApplyRouteResultError
  | ApplyRouteResultSkipped;

export type MiddlewareHandler =
  (middlewarePath: string, routeMatcherContext: RouteMatcherContext) => PromiseOrValue<MiddlewareResponse>;

export type MiddlewareResponse = {
  status?: number;

  dest?: string;

  headers?: HttpHeaders;

  requestHeaders?: HttpHeaders;

  isContinue: boolean;

  response?: Response;
};

export type ServeRouterResultHandler =
  (routerResult: RouterPhaseResult, routeMatcherContext: RouteMatcherContext) => PromiseOrValue<Response>;

export type ServeRouterErrorHandler =
  (status: number, errorCode: string | null, headers: HttpHeaders) => PromiseOrValue<Response>;

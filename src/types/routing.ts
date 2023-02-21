import { HandleValue, Route, RouteWithSrc } from "@vercel/routing-utils";
import RouteMatcherContext from "../routing/RouteMatcherContext";

export type HttpHeadersConfig = Record<string, string>;

export type ValuesAndReplacements = {
  // Original value that contains replacement tokens
  originalValue: string;
  // Final values with replacements applied
  finalValue: string;
  // The replacement values
  replacementTokens?: Record<string, string>;
};

export type Query = Record<string, string[]>;

export type RouteMatchResult = {
  // The phase where the route was matched.
  phase: HandleValue | null;

  // The pathname string that was tested.
  src: string;

  // object of the route spec that matched
  route: Route;

  // integer of the index of the route matched in the group
  routeIndex: number;

  // boolean denoting whether this had a "continue" flag on it
  isContinue: boolean;

  // integer in case exit code is intended to be changed
  status?: number;

  // object of the headers values
  headers?: Record<string, ValuesAndReplacements>;

  // request headers that are added before next route.
  // currently added only by middleware,
  // these are set using x-middleware-request headers and
  // declared using x-middleware-override-headers
  requestHeaders?: HttpHeadersConfig;

  // the dest value of the route
  dest?: ValuesAndReplacements;

  // The middleware name, if one was run
  middlewarePath?: string;

  // The middleware response, if it should be returned
  middlewareResponse?: Response;

  // boolean denoting whether we are done routing
  isDestUrl: boolean;

  // boolean denoting whether this route would cause a check
  isCheck: boolean;
};

export type PhaseResult = {
  phase: HandleValue | null;

  status?: number;

  requestHeaders?: HttpHeadersConfig;

  headers?: HttpHeadersConfig;

  dest: string;

  // The middleware response, if it should be returned
  middlewareResponse?: Response;

  // boolean denoting whether we are done routing
  isDestUrl: boolean;

  // boolean denoting whether this route would cause a check
  isCheck: boolean;
};

export type PhaseRoutesResult = PhaseResult & {
  matchedEntries: RouteMatchResult[];
  matchedRoute?: RouteWithSrc;
}

export type RouterResultBase = {
  phaseResults: PhaseRoutesResult[];
  status?: number;
  headers: HttpHeadersConfig;
  requestHeaders: HttpHeadersConfig;
}

export type RouterResultDest = RouterResultBase & {
  dest: string;
  type: 'filesystem' | 'proxy' | 'error' | 'redirect';
}

export type RouterResultMiddleware = RouterResultBase & {
  type: 'middleware';
  middlewareResponse: Response;
};

export type RouterResultStatus = RouterResultBase & {
  type: 'status';
};

export type RouterResult = RouterResultDest | RouterResultMiddleware | RouterResultStatus;

type PromiseOrValue<T> = Promise<T> | T;

export type MiddlewareHandler =
  (middlewarePath: string, routeMatcherContext: RouteMatcherContext) => PromiseOrValue<MiddlewareResponse>;

export type MiddlewareResponse = {
  status?: number;

  dest?: string;

  headers?: HttpHeadersConfig;

  requestHeaders?: HttpHeadersConfig;

  isContinue: boolean;

  response?: Response;
};

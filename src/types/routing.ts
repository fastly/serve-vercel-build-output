import { HandleValue, Route, RouteWithSrc } from "@vercel/routing-utils";
import { RouteMatcherContext } from "../routing/RouteMatcherContext";
import { PromiseOrValue } from "../utils/misc";

export type HttpHeaders = Record<string, string>;
export type HttpCookies = Record<string, string>;

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
  requestHeaders?: HttpHeaders;

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

  requestHeaders?: HttpHeaders;

  headers?: HttpHeaders;

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
  headers: HttpHeaders;
}

export type RouterResultRequestHeaders = {
  requestHeaders: HttpHeaders;
}

export type RouterResultDest = {
  dest: string;
}

export type RouterResultFilesystem = RouterResultBase & RouterResultDest & RouterResultRequestHeaders & {
  type: 'filesystem';
}

export type RouterResultProxy = RouterResultBase & RouterResultDest & RouterResultRequestHeaders & {
  type: 'proxy';
}

export type RouterResultRedirect = RouterResultBase & RouterResultDest & {
  type: 'redirect';
}

export type RouterResultMiddleware = RouterResultBase & RouterResultRequestHeaders & {
  type: 'middleware';
  middlewareResponse: Response;
};

export type RouterResultError = RouterResultBase & {
  errorCode: string;
  type: 'error';
};

export type RouterResult = RouterResultFilesystem | RouterResultProxy | RouterResultRedirect | RouterResultMiddleware | RouterResultError;

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

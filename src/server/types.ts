import { RouteMatcherContext } from "../routing/RouteMatcherContext.js";
import { RouterResult } from "../types/routing.js";

export type BackendDef = {
  url: string,
};

export type BackendsDefs = 'dynamic' | Record<string, string | BackendDef>;
export type Backends = Record<string, BackendDef>;

export type BackendInfo = {
  name: string,
  url: string,
  target: string,
};

export type RequestContext = {
  client: ClientInfo,
  requestId: string,
  initUrl: URL,

  // A "context" object that contains a "waitUntil" binding to pass to
  // the edge function.
  edgeFunctionContext: EdgeFunctionContext,
};

export type ServeRequestContext = {
  requestContext: RequestContext,
  routeMatcherContext: RouteMatcherContext,
  routeMatchResult?: RouterResult,
};

export type EdgeFunctionContext = {
  waitUntil: (promise: Promise<any>) => void,
};

export type EdgeFunction = (request: Request, context: EdgeFunctionContext) => Response;

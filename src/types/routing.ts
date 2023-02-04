import {HandleValue, Route, RouteWithSrc} from "@vercel/routing-utils";

export type HttpHeadersConfig = Record<string, string>;
export type Query = Record<string, string[]>;

export type RouteMatchLogEntryBase = {
  // The phase where the route was matched.
  phase: HandleValue | null;

  // The pathname string that was tested.
  src: string;

  // object of the route spec that matched
  route?: Route;

  // integer of the index of the route matched in the group
  routeIndex?: number;

  // if this had a "continue" flag on it
  isContinue?: boolean;

  // integer in case exit code is intended to be changed
  status?: number;

  // object of the added response header values
  headers?: HttpHeadersConfig;
};

export type RouteMatchLogEntryDest = RouteMatchLogEntryBase & {
  // The pathname string that got set.
  // It can be a full URL or a relative URL,
  dest?: string;

  // object (key=values) of new uri args to be passed along to dest
  query?: Query;
}

export type RouteMatchLogEntryMiddleware = RouteMatchLogEntryBase & {
  // The middleware name.
  middlewarePath: string;
}

export type RouteMatchLogEntry = RouteMatchLogEntryDest | RouteMatchLogEntryMiddleware;

export type PhaseRoutesResult = {
  matchedEntries: RouteMatchLogEntry[];

  matchedRoute?: RouteWithSrc;
}

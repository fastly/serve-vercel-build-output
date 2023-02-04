import { RoutesCollection } from "./RoutesCollection";
import { RouteMatcherContext } from "./RouteMatcherContext";
import { HandleValue, isHandler, Route } from "@vercel/routing-utils";
import { HttpHeadersConfig, PhaseRoutesResult, RouteMatchLogEntry } from "../types/routing";
import { resolveRouteParameters } from "./RouteSrcMatcher";
import { matchRoute } from "../utils/routing";

type MiddlewareMatchHandler = () => boolean;



export default class RouteMatcher {

  _onMiddlewareMatch: MiddlewareMatchHandler | null = null;

  _routesCollection: RoutesCollection;

  constructor(routesCollection: RoutesCollection) {
    this._routesCollection = routesCollection;
  }

  doRouter(routeMatcherContext: RouteMatcherContext) {

    this.routeMainLoop(routeMatcherContext);

  }

  checkFilesystem(routeMatcherContext: RouteMatcherContext) {

  }

  async doEdgeFunction(routeMatcherContext: RouteMatcherContext): Promise<Response> {

    // create Request from route matcher context
    throw "not implemented";

  }

  routeMainLoop(routeMatcherContext: RouteMatcherContext) {

    let phase: HandleValue | null = null;

    while(true) {
      const results = this.doPhaseRoutes(phase, routeMatcherContext);

      // null phase cannot have check
      if (phase != null && results.matchedRoute?.check) {
        // "check" restarts this loop at the rewrite phase.
        phase = 'rewrite';
        continue;
      }

      // results
      // check if dest is a full URL or a relative URL
      // - full URL -> pipe through backend

      // match the file to filesystem
      let matched = true;

      // check redirects and status codes
      // send redirect or send error

      // check match
      if (matched) {

        const hitResults = this.doPhaseRoutes('hit', routeMatcherContext);
        if (hitResults.matchedRoute != null) {
          // items will all have "continue": true
          // so there will be no matched route.
          // if there is one then it's unexpected.
          throw "unexpected";
        }

        // serve it and end

      } else {

        const missRoutes = this.doPhaseRoutes('miss', routeMatcherContext);
        if (missRoutes.matchedRoute != null) {
          // if matches, then it has a dest and check
          if (
            missRoutes.matchedRoute.dest != null &&
            missRoutes.matchedRoute.check
          ) {
            // "check" restarts this loop at the rewrite phase.
            phase = 'rewrite';
            continue;
          }

          throw "unexpected";
        }

      }

      switch (phase) {
        case null:
        case 'rewrite': {
          if (this._routesCollection.getPhaseRoutes('filesystem').length > 0) {
            phase = 'filesystem';
            continue;
          }
          // fall through
        }
        case 'filesystem': {
          if (this._routesCollection.getPhaseRoutes('resource').length > 0) {
            phase = 'resource';
            continue;
          }
        }
      }

      break;
    }

  }

  doPhaseRoutes(phase: HandleValue | null, routeMatcherContext: RouteMatcherContext): PhaseRoutesResult {

    const matchedEntries: RouteMatchLogEntry[] = [];
    let matchedRoute: Route | undefined = undefined;

    const phaseRoutes = this._routesCollection.getPhaseRoutes(phase);

    for (const [routeIndex, route] of phaseRoutes.entries()) {

      if (isHandler(route)) {
        // We don't expect any Handle, only Source routes
        continue;
      }

      const matchResult = matchRoute(route, routeMatcherContext);
      if (!matchResult) {
        continue;
      }

      const isContinue = route.continue;

      let entry: RouteMatchLogEntry = {
        phase,
        src: routeMatcherContext.pathname,
        route,
        routeIndex,
        isContinue,
      };

      let status: number | undefined;
      let dest: string | undefined;
      let headers: HttpHeadersConfig | undefined;

      // Edge Middleware can only happen during "null" phase
      if (phase == null && route.middlewarePath != null) {

        entry = {
          ...entry,
          middlewarePath: route.middlewarePath
        };

        if (this._onMiddlewareMatch != null) {
          this._onMiddlewareMatch();
        }

        // redirect - status + location header
        // rewrite - x-middleware-rewrite

        // next - x-middleware-next. This is supposed to continue the middleware
        // chain. Currently Next seems to only allow you to
        // set request headers
        // set response cookies, and set response headers
        // if this is not present, then just return the response.

        // request headers are set in NextResponse.request.headers
        // they are transferred to the headers:
        // x-middleware-request-
        // and
        // x-middleware-override-headers
        // set these on request headers before going to next

        // response headers/cookies are just on the headers
        // so apply them.

        // status - probably don't use, but get it from the response

      } else {

        dest = route.dest;
        status = route.status;
        headers = route.headers;

        entry = {
          ...entry,
          dest,
          status,
          headers,
        };

        let destPathname = routeMatcherContext.pathname;
        if (route.dest != null) {
          destPathname = resolveRouteParameters(route.dest, matchResult.match, matchResult.keys);
        }

      }

      matchedEntries.push(entry);

      if (!route.continue) {
        // We are exiting because a match
        // "continue" doesn't count as a match
        matchedRoute = route;
        break;
      }

    }

    return {
      matchedEntries,
      matchedRoute,
    };

  }

}

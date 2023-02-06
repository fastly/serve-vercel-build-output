import { HandleValue, isHandler, RouteWithSrc } from "@vercel/routing-utils";
import RoutesCollection from "./RoutesCollection";
import RouteMatcherContext from "./RouteMatcherContext";
import {
  HttpHeadersConfig, MiddlewareHandler, MiddlewareResponse,
  PhaseResult,
  PhaseRoutesResult,
  RouteMatchResult,
  RouterResult,
} from "../types/routing";
import { applyRouteResults, matchRoute } from "../utils/routing";

type PromiseOrValue<T> = Promise<T> | T;

export type InitHeadersHandler = () => PromiseOrValue<HttpHeadersConfig>;

export type CheckFilesystemHandler =
  (pathname: string) => PromiseOrValue<boolean>;

export default class RouteMatcher {

  _routesCollection: RoutesCollection;

  onCheckFilesystem?: CheckFilesystemHandler;

  onMiddleware?: MiddlewareHandler;

  onInitHeaders?: InitHeadersHandler;

  constructor(routesCollection: RoutesCollection) {
    this._routesCollection = routesCollection;
  }

  async doRouter(routeMatcherContext: RouteMatcherContext) {
    await this.routeMainLoop(routeMatcherContext);
  }

  async checkFilesystem(pathname: string): Promise<boolean> {
    if (this.onCheckFilesystem != null) {
      return this.onCheckFilesystem(pathname);
    }
    return false;
  }

  async doMiddlewareFunction(
    middlewarePath: string,
    routeMatcherContext: RouteMatcherContext
  ): Promise<MiddlewareResponse> {

    if (this.onMiddleware != null) {
      return this.onMiddleware(middlewarePath, routeMatcherContext);
    }

    return {
      isContinue: true,
    };

  }

  async initHeaders(): Promise<HttpHeadersConfig> {
    if (this.onInitHeaders != null) {
      return this.onInitHeaders();
    }
    return {};
  }

  async routeMainLoop(routeMatcherContext: RouteMatcherContext): Promise<RouterResult> {

    const phaseResults: PhaseRoutesResult[] = [];
    const headers = await this.initHeaders();

    function mergeHeaders(phase: HandleValue | null, phaseHeaders: HttpHeadersConfig | undefined) {
      if (phaseHeaders != null) {
        for (const [key, value] of Object.entries(phaseHeaders)) {
          if ((phase === 'hit' || phase === 'miss') && Object.prototype.hasOwnProperty.call(headers, key.toLowerCase())) {
            // For some reason,
            // for hit or miss we only ADD headers, we don't overwrite.
            continue;
          }
          headers[key.toLowerCase()] = value;
        }
      }
    }

    let phase: HandleValue | null = null;

    while(true) {
      const phaseResult = await this.doPhaseRoutes(phase, routeMatcherContext);
      phaseResults.push(phaseResult);

      mergeHeaders(phase, phaseResult.headers);

      if (phaseResult.middlewareResponse != null) {
        // is middleware response
        return {
          phaseResults,
          headers,
          dest: phaseResult.dest,
          middlewareResponse: phaseResult.middlewareResponse,
          type: 'middleware',
        };
      }

      if (phaseResult.isDestUrl) {
        // is destination URL, we will proxy and be done with it
        return {
          phaseResults,
          headers,
          dest: phaseResult.dest,
          type: 'proxy',
        };
      }

      // See if we are supposed to do a "check".
      // "check" restarts this loop at the rewrite phase.
      if (phase != null && phaseResult.isCheck) {
        // null phase cannot have check
        phase = 'rewrite';
        continue;
      }

      // match the file to filesystem
      // this can be a static file OR a function
      let matched = await this.checkFilesystem(phaseResult.dest);

      // check redirects and status codes
      // send redirect or send error

      // check match
      if (matched) {

        const hitResults = await this.doPhaseRoutes('hit', routeMatcherContext);
        phaseResults.push(hitResults);

        if (hitResults.matchedRoute != null) {
          // items will all have "continue": true so there will be no matched route.
          // items here cannot set status or a destination path
          throw new Error("hit phase routes must have continue");
        }

        mergeHeaders('hit', hitResults.headers);

        // serve it and end
        return {
          phaseResults,
          headers,
          dest: phaseResult.dest,
          type: 'filesystem',
        };

      } else {

        const missResults = await this.doPhaseRoutes('miss', routeMatcherContext);
        phaseResults.push(missResults);

        mergeHeaders('miss', missResults.headers);

        if (missResults.matchedRoute != null) {
          // if matches, then it has a dest and check
          if (
            missResults.matchedRoute.dest != null &&
            missResults.matchedRoute.check
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

    // TODO: probably do error routes here

    return {
      phaseResults,
      status: 404,
      headers,
      dest: routeMatcherContext.pathname,
      type: 'error',
    };

  }

  async doPhaseRoutes(phase: HandleValue | null, routeMatcherContext: RouteMatcherContext): Promise<PhaseRoutesResult> {

    const matchedEntries: RouteMatchResult[] = [];
    let matchedRoute: RouteWithSrc | undefined = undefined;

    const phaseResult: PhaseResult = {
      phase,
      dest: routeMatcherContext.pathname,
      isDestUrl: false,
      isCheck: false,
    };

    const phaseRoutes = this._routesCollection.getPhaseRoutes(phase);

    for (const [routeIndex, route] of phaseRoutes.entries()) {

      if (isHandler(route)) {
        // We don't expect any Handle, only Source routes
        continue;
      }

      const routeMatchResult = await matchRoute(
        phase,
        routeIndex,
        route,
        routeMatcherContext,
        this.doMiddlewareFunction.bind(this)
      );

      if(!routeMatchResult) {
        continue;
      }

      matchedEntries.push(routeMatchResult);

      // Apply results from this route
      applyRouteResults(routeMatchResult, phaseResult, routeMatcherContext);

      if (
        routeMatchResult.middlewareResponse != null ||
        routeMatchResult.isDestUrl ||
        !routeMatchResult.isContinue
      ) {
        // if this is a "dest url" or "continue" is false, then
        // we are exiting as a match
        matchedRoute = route;
        break;
      }

      // "continue" doesn't count as a match
    }

    return {
      ...phaseResult,
      matchedEntries,
      matchedRoute,
    };
  }
}

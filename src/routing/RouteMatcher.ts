import { HandleValue, isHandler, RouteWithSrc } from "@vercel/routing-utils";
import { RoutesCollection } from "./RoutesCollection";
import { RouteMatcherContext } from "./RouteMatcherContext";
import {
  HttpHeadersConfig, MiddlewareResponse,
  PhaseResult,
  PhaseRoutesResult,
  RouteMatchResult, RouterResult,
  ValuesAndReplacements
} from "../types/routing";
import { resolveRouteParameters } from "./RouteSrcMatcher";
import { applyRouteResults, isURL, testRoute}  from "../utils/routing";

export default class RouteMatcher {

  _routesCollection: RoutesCollection;

  constructor(routesCollection: RoutesCollection) {
    this._routesCollection = routesCollection;
  }

  async doRouter(routeMatcherContext: RouteMatcherContext) {
    await this.routeMainLoop(routeMatcherContext);
  }

  async checkFilesystem(pathname: string): Promise<boolean> {
    return true;
  }

  async doMiddlewareFunction(
    middlewarePath: string,
    routeMatcherContext: RouteMatcherContext
  ): Promise<MiddlewareResponse> {

    return {
      isContinue: true,
    };

  }

  async initHeaders(): Promise<HttpHeadersConfig> {
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

        if (hitResults.matchedRoute != null ||
          hitResults.status != null ||
          hitResults.dest != null
        ) {
          // items will all have "continue": true so there will be no matched route.
          // items here cannot set status or a destination path
          throw "unexpected";
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

        const missRoutes = await this.doPhaseRoutes('miss', routeMatcherContext);
        phaseResults.push(missRoutes);

        mergeHeaders('miss', missRoutes.headers);

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

    // TODO: probably do error routes here

    return {
      phaseResults,
      status: 404,
      headers,
      dest: '',
      type: 'error',
    };

  }

  async matchRoute(phase: HandleValue | null, routeIndex: number, route: RouteWithSrc, routeMatcherContext: RouteMatcherContext): Promise<RouteMatchResult | false> {

    const testRouteResult = testRoute(route, routeMatcherContext);
    if (!testRouteResult) {
      return false;
    }

    let isContinue: boolean | undefined;
    let status: number | undefined = undefined;
    let requestHeaders: HttpHeadersConfig | undefined = undefined;
    let headers: Record<string, ValuesAndReplacements> | undefined = undefined;
    let dest: ValuesAndReplacements | undefined = undefined;
    let isDestUrl: boolean;
    let middlewarePath: string | undefined = undefined;
    let middlewareResponse: Response | undefined = undefined;
    let isCheck: boolean;

    // Edge Middleware can only happen during "null" phase
    if (phase == null && route.middlewarePath != null) {

      middlewarePath = route.middlewarePath;

      const response = await this.doMiddlewareFunction(middlewarePath, routeMatcherContext);

      status = response.status;
      if (response.dest != null) {
        dest = {
          originalValue: response.dest,
          finalValue: response.dest,
        };
      }

      if(response.headers) {
        for (const [key, value] of Object.entries(response.headers)) {
          if (headers == null) {
            headers = {};
          }
          headers[key.toLowerCase()] = {
            originalValue: value,
            finalValue: value,
          };
        }
      }

      requestHeaders = response.requestHeaders;
      isContinue = response.isContinue;

      if (response.response != null) {
        middlewareResponse = response.response;
      }

    } else {

      isContinue = route.continue ?? false;

      if (route.dest != null) {
        dest = resolveRouteParameters(route.dest, testRouteResult.match, testRouteResult.keys);
      }

      if (route.headers != null) {
        for (const [key, value] of Object.entries(route.headers)) {
          if (headers == null) {
            headers = {};
          }
          headers[key.toLowerCase()] = resolveRouteParameters(value, testRouteResult.match, testRouteResult.keys);
        }
      }

      if (route.status != null) {
        status = route.status;
      }
    }

    isDestUrl = dest != null ? isURL(dest.finalValue) : false;
    isCheck = route.check ?? false;

    return {
      phase,
      src: routeMatcherContext.pathname,
      route,
      routeIndex,
      isContinue,
      status,
      headers,
      requestHeaders,
      dest,
      isDestUrl,
      isCheck,
      middlewarePath,
      middlewareResponse,
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

      const routeMatchResult = await this.matchRoute(phase, routeIndex, route, routeMatcherContext);
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

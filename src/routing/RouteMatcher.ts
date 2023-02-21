import { HandleValue, isHandler, RouteWithSrc } from "@vercel/routing-utils";
import RoutesCollection from "./RoutesCollection";
import RouteMatcherContext from "./RouteMatcherContext";
import {
  HttpHeadersConfig,
  MiddlewareHandler,
  MiddlewareResponse,
  PhaseResult,
  PhaseRoutesResult,
  RouteMatchResult,
  RouterResult,
} from "../types/routing";
import { applyRouteResults, matchRoute } from "../utils/routing";
import ILogger from "../logging/ILogger";
import ILoggerProvider from "../logging/ILoggerProvider";

type PromiseOrValue<T> = Promise<T> | T;

export type InitHeadersHandler = () => PromiseOrValue<HttpHeadersConfig>;

export type CheckFilesystemHandler =
  (pathname: string) => PromiseOrValue<boolean>;

export default class RouteMatcher {

  _routesCollection: RoutesCollection;

  _logger?: ILogger;

  onCheckFilesystem?: CheckFilesystemHandler;

  onMiddleware?: MiddlewareHandler;

  onInitHeaders?: InitHeadersHandler;

  constructor(
    routesCollection: RoutesCollection,
    loggerProvider?: ILoggerProvider
  ) {
    this._routesCollection = routesCollection;
    this._logger = loggerProvider?.getLogger(this.constructor.name);
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

  handleRedirectResult(
    phaseResults: PhaseRoutesResult[],
    phaseResult: PhaseRoutesResult,
  ): RouterResult | null {
    if (phaseResult.status == null || phaseResult.status < 300 || phaseResult.status >= 400) {
      return null;
    }

    const location = phaseResult.headers?.['location'] ?? phaseResult.dest;
    if (location === '') {
      return null;
    }

    return {
      phaseResults,
      status: phaseResult.status,
      dest: location,
      headers: {},
      type: 'redirect',
    };
  }

  handleStatusResult(
    phaseResults: PhaseRoutesResult[],
    phaseResult: PhaseRoutesResult,
    headers: HttpHeadersConfig,
  ): RouterResult | null {
    if (phaseResult.status == null) {
      return null;
    }

    return {
      phaseResults,
      status: phaseResult.status,
      headers,
      errorCode: '',
      type: 'error',
    };
  }

  async doRouter(routeMatcherContext: RouteMatcherContext): Promise<RouterResult> {

    const phaseResults: PhaseRoutesResult[] = [];
    let status: number | undefined = undefined;
    const headers = await this.initHeaders();

    function mergeHeaders(phase: HandleValue | null, phaseHeaders: HttpHeadersConfig | undefined) {
      if (phaseHeaders != null) {
        // Note: keys are already lowercase
        for (const [key, value] of Object.entries(phaseHeaders)) {
          if ((phase === 'hit' || phase === 'miss') && Object.prototype.hasOwnProperty.call(headers, key)) {
            // For some reason,
            // for hit or miss we only ADD headers, we don't overwrite.
            continue;
          }
          headers[key] = value;
        }
      }
    }

    let phase: HandleValue | null = null;

    // Phases go in this order:
    //   null -> filesystem -> resource
    // However, a route in the filesystem and resource phases
    // can set check: true.  If it does, then it jumps to the rewrite phase
    //   rewrite -> filesystem -> resource

    while(true) {
      const phaseResult = await this.doPhaseRoutes(phase, routeMatcherContext);
      phaseResults.push(phaseResult);

      mergeHeaders(phase, phaseResult.headers);
      if (phaseResult.status != null) {
        status = phaseResult.status;
      }

      if (phaseResult.middlewareResponse != null) {
        // is middleware response
        return {
          phaseResults,
          status,
          headers,
          requestHeaders: routeMatcherContext.headers,
          middlewareResponse: phaseResult.middlewareResponse,
          type: 'middleware',
        };
      }

      if (phaseResult.isDestUrl) {
        // is destination URL, we will proxy and be done with it
        return {
          phaseResults,
          status,
          headers,
          requestHeaders: routeMatcherContext.headers,
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

      // NOTE: Need research - what to do if check and location are both set?

      // match the file to filesystem
      // this can be a static file OR a function
      let matched = await this.checkFilesystem(phaseResult.dest);

      // Handle this if it's a redirect
      const redirectResult = this.handleRedirectResult(
        phaseResults,
        phaseResult
      );
      if (redirectResult != null) {
        return redirectResult;
      }

      // If this was not a match in the filesystem, then
      // handle the status code too
      if (!matched) {
        const statusResult = this.handleStatusResult(
          phaseResults,
          phaseResult,
          headers,
        );
        if (statusResult != null) {
          return statusResult;
        }
      }

      // check match
      if (matched) {

        if (this._routesCollection.getPhaseRoutes('hit').length > 0) {
          const hitResults = await this.doPhaseRoutes('hit', routeMatcherContext);
          phaseResults.push(hitResults);

          if (hitResults.matchedRoute != null) {
            // items will all have "continue": true so there will be no matched route.
            // items here cannot set status or a destination path
            throw new Error("hit phase routes must have continue");
          }

          mergeHeaders('hit', hitResults.headers);
        }

        // serve it and end
        return {
          phaseResults,
          status,
          headers,
          requestHeaders: routeMatcherContext.headers,
          dest: phaseResult.dest,
          type: 'filesystem',
        };

      } else {

        if (this._routesCollection.getPhaseRoutes('miss').length > 0) {

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

    // If we are here, then it means we have had no match
    if (this._routesCollection.getPhaseRoutes('error').length > 0) {
      const errorResults = await this.doPhaseRoutes('error', routeMatcherContext);
      phaseResults.push(errorResults);

      // error phase seems to be strange --
      // it seems I should ignore check here but still merge headers and status
      // probably also makes no sense to do hit or miss phases here

      mergeHeaders(phase, errorResults.headers);
      if (errorResults.status != null) {
        status = errorResults.status;
      }

      // NOTE: Still need to find out, if this is destination URL, we will still proxy?
      // If not, we should remove this.
      if (errorResults.isDestUrl) {
        return {
          phaseResults,
          status,
          headers,
          requestHeaders: routeMatcherContext.headers,
          dest: errorResults.dest,
          type: 'proxy',
        };
      }

      // match the file to filesystem
      // this can be a static file OR a function
      let matched = await this.checkFilesystem(errorResults.dest);

      // Handle this if it's a redirect
      const redirectResult = this.handleRedirectResult(
        phaseResults,
        errorResults
      );
      if (redirectResult != null) {
        return redirectResult;
      }

      // If this was not a match in the filesystem, then
      // handle the status code too
      if (!matched) {
        const statusResult = this.handleStatusResult(
          phaseResults,
          errorResults,
          headers,
        );
        if (statusResult != null) {
          return statusResult;
        }
      }

      // NOTE: need to find out if this is the right behavior:
      // We do no hit or miss, and then just end (?)
      if (matched) {
        return {
          phaseResults,
          status,
          headers,
          requestHeaders: routeMatcherContext.headers,
          dest: errorResults.dest,
          type: 'filesystem',
        };
      }
    }

    return {
      phaseResults,
      headers,
      status: 500,
      errorCode: '',
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
        (path, ctx) => this.doMiddlewareFunction(path, ctx),
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

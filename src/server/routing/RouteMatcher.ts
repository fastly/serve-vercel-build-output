import { isHandler, RouteWithSrc } from "@vercel/routing-utils";

import RoutesCollection from "./RoutesCollection.js";
import { createRouteMatcherContext } from "./RouteMatcherContext.js";
import { isURL, resolveRouteParameters, testRoute} from "../utils/routing.js";
import { getLogger, ILogger } from "../logging/index.js";
import { PromiseOrValue } from "../utils/misc.js";

import type {
  HttpHeaders,
  PhaseName,
  RouteMatcherContext,
  RouterPhaseResult,
  ServeRouterResultHandler,
  MiddlewareHandler,
  MiddlewareResponse,
  ApplyRouteResultError,
} from "../types/routing.js";
import {ApplyRouteResult, ServeRouterErrorHandler} from "../types/routing.js";

export type CheckFilesystemHandler =
  (pathname: string) => PromiseOrValue<boolean>;

const ALLOWED_ROUTER_PHASE_RESULTS: Record<RouterPhaseResult['type'], PhaseName[]> = {
  'redirect': [ null ],
  'proxy': [ null, 'filesystem', 'rewrite', 'resource', ],
  'dest': [ null, 'main', 'resource', 'filesystem', 'rewrite', 'miss', 'error', ],
  'synthetic': [ null ],
  'error': [ null, 'main', 'resource', 'filesystem', 'rewrite', 'hit', 'miss', 'error', ],
}

export default class RouteMatcher {

  _routesCollection: RoutesCollection;

  _logger?: ILogger;

  onCheckFilesystem?: CheckFilesystemHandler;

  onMiddleware?: MiddlewareHandler;

  onServeRouterResult?: ServeRouterResultHandler;

  onServeRouterError?: ServeRouterErrorHandler;

  constructor(
    routesCollection: RoutesCollection,
  ) {
    this._routesCollection = routesCollection;
    this._logger = getLogger(this.constructor.name);
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

  async serveRouterResult(
    routerResult: RouterPhaseResult,
    routeMatcherContext: RouteMatcherContext,
  ) {
    if (this.onServeRouterResult == null) {
      throw new Error('Unexpected! onServeRouterResult not set.');
    }
    return this.onServeRouterResult(routerResult, routeMatcherContext);
  }

  async serveRouterError(
    status: number,
    errorCode: string | null = null,
    headers: HttpHeaders = {},
  ) {
    if (this.onServeRouterError == null) {
      throw new Error('Unexpected! onServeRouterError not set.');
    }
    return this.onServeRouterError(status, errorCode, headers);
  }

  async doRouter(request: Request): Promise<Response> {

    const routeMatcherContext = createRouteMatcherContext(request);

    // Save the initial state and then restore it at the start of each loop
    const initialState = routeMatcherContext.getState();

    this._logger?.debug('routeMatcherContext', {
      method: routeMatcherContext.method,
      host: routeMatcherContext.host,
      pathname: routeMatcherContext.pathname,
      headers: routeMatcherContext.headers,
      query: routeMatcherContext.query,
    });

    const phases: PhaseName[] = [
      null,        // Initial phase
      'main',      // Main phase
      'resource',  // Resource phase
    ];

    let errorRouteResult: ApplyRouteResultError | null = null;

    for (const phase of phases) {

      routeMatcherContext.restoreState(initialState);

      const routerPhaseResult = await this.doRouterPhase(phase, routeMatcherContext);
      this._logger?.debug('routerPhaseResult', JSON.stringify(routerPhaseResult, null, 2));

      const applyRouteResult = await this.applyRouterPhaseResult(routerPhaseResult, routeMatcherContext);
      this._logger?.debug('applyRouteResult', JSON.stringify(applyRouteResult, null, 2));
      if (applyRouteResult.type === 'applied') {
        return applyRouteResult.response;
      }

      if (applyRouteResult.type === 'error') {
        errorRouteResult = applyRouteResult;
        break;
      }
    }

    // Error Phase
    if (errorRouteResult == null) {
      errorRouteResult = {
        type: 'error',
        status: 404,
      };
    }

    // Error handler
    const errorPhaseResult = await this.doRouterPhase('error', routeMatcherContext);
    if (errorPhaseResult.matchedRoute != null) {

      const applyRouteResult = await this.applyRouterPhaseResult(errorPhaseResult, routeMatcherContext);
      if (applyRouteResult.type === 'applied') {
        return applyRouteResult.response;
      }

      if (applyRouteResult.type === 'error') {
        return await this.serveRouterError(500, null, routeMatcherContext.headers);
      }

    }

    return await this.serveRouterError(errorRouteResult.status ?? 404, errorRouteResult.errorCode, routeMatcherContext.headers);
  }

  async doRouterPhase(phase: PhaseName, routeMatcherContext: RouteMatcherContext): Promise<RouterPhaseResult> {

    const phaseRoutes = this._routesCollection.getPhaseRoutes(phase);

    const matchStatus = phase === 'error';
    const canAddResponseHeaders = phase !== 'hit' && phase !== 'miss';

    // Make a copy of the pathname for rewrite
    const originalDest = routeMatcherContext.pathname;

    let matchedRoute: RouteWithSrc | null = null;
    let matchedRouteIndex: number | null = null;

    for (const [routeIndex, route] of phaseRoutes.entries()) {

      if (isHandler(route)) {
        // We don't really expect these, but just in case
        continue;
      }

      this._logger?.debug({
        route,
        status: routeMatcherContext.status,
        pathname: routeMatcherContext.pathname,
        query: routeMatcherContext.query,
        matchStatus,
      });

      const testRouteResult = testRoute(route, routeMatcherContext, matchStatus);
      if (!testRouteResult) {
        continue;
      }

      let isContinue: boolean | undefined;
      let status: number | undefined = undefined;
      let requestHeaders: HttpHeaders | undefined = undefined;
      let responseHeaders: Record<string, string> | undefined = undefined;
      let dest: string | undefined = undefined;
      let syntheticResponse: Response | undefined = undefined;
      let isCheck: boolean;

      if (route.middlewarePath != null) {
        if (phase != null) {
          throw new Error('Unexpected! middleware should only be when phase == null');
        }

        if (route.dest != null || route.status != null || route.headers != null) {
          throw new Error('Unexpected! middleware route should not have dest, status, or headers');
        }

        const response = await this.doMiddlewareFunction(route.middlewarePath, routeMatcherContext);

        status = response.status;
        if (response.dest != null) {
          dest = response.dest;
        }

        if (response.headers) {
          for (const [key, value] of Object.entries(response.headers)) {
            if (responseHeaders == null) {
              responseHeaders = {};
            }
            responseHeaders[key.toLowerCase()] = value;
          }
        }

        requestHeaders = response.requestHeaders;
        isContinue = response.isContinue;

        if (response.response != null) {
          syntheticResponse = response.response;
        }

      } else {

        // Only do string replacements for non-middleware paths
        if (route.dest != null) {
          if (phase == 'hit') {
            throw new Error(`Unexpected! 'hit' phase cannot have a route with 'dest'.`);
          }
          dest = resolveRouteParameters(route.dest, testRouteResult.match, testRouteResult.keys);
        }

        if (route.headers != null) {
          for (const [key, value] of Object.entries(route.headers)) {
            if (responseHeaders == null) {
              responseHeaders = {};
            }
            responseHeaders[key.toLowerCase()] = resolveRouteParameters(value, testRouteResult.match, testRouteResult.keys);
          }
        }

        if (route.status != null) {
          if (phase == 'hit') {
            throw new Error(`Unexpected! 'hit' phase cannot have a route with 'status'.`);
          }
          if (phase !== 'error') {
            status = route.status;
          }
        }

        isContinue = route.continue ?? false;
        if (phase == 'hit') {
          if (!isContinue) {
            throw new Error(`Unexpected! 'hit' phase cannot have a route without 'continue'.`);
          }
        }
      }

      isCheck = route.check ?? false;
      if (phase == 'hit') {
        if (isCheck) {
          throw new Error(`Unexpected! 'hit' phase cannot have a route with 'check'.`);
        }
      }

      // Merge request headers
      if (requestHeaders != null) {
        for (const [key, value] of Object.entries(requestHeaders)) {
          routeMatcherContext.setRequestHeader(key.toLowerCase(), value);
        }
      }

      // Apply status
      if (status != null) {
        routeMatcherContext.setStatus(status);
      }

      // Merge response headers
      if (responseHeaders != null) {
        for (const [key, value] of Object.entries(responseHeaders)) {
          routeMatcherContext.setResponseHeader(key.toLowerCase(), value, canAddResponseHeaders);
        }
      }

      // Apply dest
      if (dest != null) {
        routeMatcherContext.setDest(dest);
      }

      // Handle synthetic result
      if (syntheticResponse != null) {
        return {
          type: 'synthetic',
          phase,
          matchedRoute: route,
          routeIndex,
          response: syntheticResponse,
        };
      }

      // Handle proxy result
      if (isURL(dest)) {
        return {
          type: 'proxy',
          phase,
          matchedRoute: route,
          routeIndex,
          dest,
        };
      }

      // Handle redirect
      if (status != null && status >= 300 && status < 400) {

        const location = responseHeaders?.['location'] ?? dest;
        if (location !== '') {
          return {
            type: 'redirect',
            phase,
            matchedRoute: route,
            routeIndex,
            dest: location,
            status,
          };
        }

      }

      // Handle continue
      if (!isContinue) {
        matchedRoute = route;
        matchedRouteIndex = routeIndex;
        break;
      }
    }

    if (
      routeMatcherContext.status != null &&
      (routeMatcherContext.status < 200 || routeMatcherContext.status >= 400)
    ) {
      return {
        type: 'error',
        phase,
        matchedRoute: matchedRoute ?? undefined,
        routeIndex: matchedRouteIndex ?? undefined,
        status: routeMatcherContext.status,
      };
    }

    return {
      type: 'dest',
      phase,
      matchedRoute: matchedRoute ?? undefined,
      routeIndex: matchedRouteIndex ?? undefined,
      dest: routeMatcherContext.pathname,
      originalDest: phase === 'rewrite' ? originalDest : undefined,
    };
  }

  async applyRouterPhaseResult(routerPhaseResult: RouterPhaseResult, routeMatcherContext: RouteMatcherContext): Promise<ApplyRouteResult> {

    const { phase } = routerPhaseResult;

    // 'filesystem' is a special phase, and we don't apply 'dest',
    // because we need to give 'rewrite' a chance to modify the 'dest' again
    // before looking in the filesystem for the dest.
    const doDest = phase !== 'filesystem';

    // 'error' is a phase where we can't apply 'check'
    const doCheck = phase !== 'error';

    if (
      !ALLOWED_ROUTER_PHASE_RESULTS[routerPhaseResult.type].includes(phase)
    ) {
      throw new Error(`Unexpected! Router phase result type '${routerPhaseResult.type}' cannot be handled in phase '${phase}'.`)
    }

    this._logger?.debug('applyRouterPhaseResult routerPhaseResult', routerPhaseResult);
    this._logger?.debug('applyRouterPhaseResult routeMatcherContext', routeMatcherContext);

    if (
      routerPhaseResult.type === 'synthetic' ||
      routerPhaseResult.type === 'redirect' ||
      routerPhaseResult.type === 'proxy' ||
      routerPhaseResult.type === 'error'
    ) {
      try {
        const response = await this.serveRouterResult(routerPhaseResult, routeMatcherContext);
        return {
          type: 'applied',
          response,
        };
      } catch {
        return {
          type: 'error',
          status: 500,
        };
      }
    }

    if (doDest && routerPhaseResult.type === 'dest') {

      if (routerPhaseResult.dest == null) {
        throw new Error(`Unexpected! dest is null while handling router phase result type 'dest'.`);
      }

      let matched = await this.checkFilesystem(routerPhaseResult.dest);
      if (matched) {

        const hitResult = await this.doRouterPhase('hit', routeMatcherContext);
        if (hitResult.matchedRoute != null) {
          // items will all have "continue": true so there will be no matched route.
          // items here cannot set status or a destination path
          throw new Error("hit phase routes must have continue");
        }

        // above would also have applied `headers`
        try {
          const response = await this.serveRouterResult(routerPhaseResult, routeMatcherContext);
          return {
            type: 'applied',
            response,
          };
        } catch {
          return {
            type: 'error',
            status: 500,
          };
        }

      }

      if (doCheck) {

        const filesystemRoutesResult = await this.doRouterPhase('filesystem', routeMatcherContext);
        this._logger?.debug('filesystem routes - filesystemRoutesResult', JSON.stringify(filesystemRoutesResult, null, 2));
        if (filesystemRoutesResult.matchedRoute != null) {

          const applyRouteResult = await this.applyRouterPhaseResult(filesystemRoutesResult, routeMatcherContext);
          this._logger?.debug('filesystem routes - applyRouteResult', JSON.stringify(applyRouteResult, null, 2));
          // Because this is the 'filesystem' phase, it would be 'skipped' if the route has just a dest
          if (applyRouteResult.type !== 'skipped') {
            return applyRouteResult;
          }

        } else {

          const prevState = routeMatcherContext.getState();
          try {

            const missRoutesResult = await this.doRouterPhase('miss', routeMatcherContext);
            this._logger?.debug('filesystem miss routes - missRoutesResult', JSON.stringify(missRoutesResult, null, 2));
            if (missRoutesResult.matchedRoute != null) {

              const applyRouteResult = await this.applyRouterPhaseResult(missRoutesResult, routeMatcherContext);
              this._logger?.debug('filesystem miss routes - applyRouteResult', JSON.stringify(applyRouteResult, null, 2));
              if (applyRouteResult.type !== 'skipped') {
                return applyRouteResult;
              }

            }

          } finally {
            routeMatcherContext.restoreState(prevState);
          }

        }

        const rewriteRoutesResult = await this.doRouterPhase('rewrite', routeMatcherContext);
        this._logger?.debug('rewrite routes - rewriteRoutesResult', JSON.stringify(rewriteRoutesResult, null, 2));
        if (rewriteRoutesResult.matchedRoute != null) {

          const applyRouteResult = await this.applyRouterPhaseResult(rewriteRoutesResult, routeMatcherContext);
          this._logger?.debug('rewrite routes - applyRouteResult', JSON.stringify(applyRouteResult, null, 2));
          if (applyRouteResult.type !== 'skipped') {
            return applyRouteResult;
          }

        }

      } else {

        const prevState = routeMatcherContext.getState();
        try {

          // If we're not doing a check, then we will do just a miss phase.
          const missRoutesResult = await this.doRouterPhase('miss', routeMatcherContext);
          this._logger?.debug('miss routes - missRoutesResult', JSON.stringify(missRoutesResult, null, 2));
          if (missRoutesResult.matchedRoute != null) {

            const applyRouteResult = await this.applyRouterPhaseResult(missRoutesResult, routeMatcherContext);
            this._logger?.debug('miss routes - applyRouteResult', JSON.stringify(applyRouteResult, null, 2));
            if (applyRouteResult.type !== 'skipped') {
              return applyRouteResult;
            }

          }

        } finally {
          routeMatcherContext.restoreState(prevState);
        }

      }

    }

    return {
      type: 'skipped',
    };
  }
}

import { RoutesCollection } from "./RoutesCollection";
import { RouteMatcherContext } from "./RouteMatcherContext";
import { HandleValue, isHandler, RouteWithSrc } from "@vercel/routing-utils";
import { RouteMatchResult } from "../types/routing";
import { resolveRouteParameters, RouteSrcMatcher, RouteSrcMatchResult } from "./RouteSrcMatcher";
import { HasFieldEntry } from "../types/server";

export default class RouteMatcher {

  _routesCollection: RoutesCollection;

  constructor(routesCollection: RoutesCollection) {
    this._routesCollection = routesCollection;
  }

  doRouter(routeMatcherContext: RouteMatcherContext) {

    this.routeMainLoop(routeMatcherContext);

  }

  matchRoute(route: RouteWithSrc, routeMatcherContext: RouteMatcherContext): RouteSrcMatchResult | false {

    const { methods, has, missing } = route;

    // methods
    if (Array.isArray(methods) &&
      !methods.includes(routeMatcherContext.method)
    ) {
      return false;
    }

    // has
    if (Array.isArray(has) &&
      !has.every(hasField => this.matchHasField(hasField, routeMatcherContext))
    ) {
      return false;
    }

    // missing
    if (Array.isArray(missing) &&
      missing.some(hasField => this.matchHasField(hasField, routeMatcherContext))
    ) {
      return false;
    }

    const matchResult = RouteSrcMatcher.exec(route, routeMatcherContext.pathname);
    if (matchResult == null) {
      return false;
    }

    return matchResult;

  }

  matchHasField(
    hasField: HasFieldEntry,
    context: RouteMatcherContext,
  ) {

    const { type } = hasField;
    switch(type) {
      case 'host':
        return hasField.value == context.host;
      case 'cookie': {
        const { key, value } = hasField;
        const cookieValue = context.cookies.get(key);
        if (cookieValue == null) {
          return false;
        }
        if (value == null) {
          return true;
        }
        // TODO: if value is a regex
        return cookieValue === value;
      }
      case 'query': {
        const { key, value } = hasField;
        const queryValue = context.query[key];
        if (queryValue == null) {
          return false;
        }
        if (value == null) {
          return true;
        }
        // TODO: if value is a regex
        return queryValue.some(v => v === value);
      }
      case 'header': {
        const { key, value } = hasField;
        const headerValue = context.headers[key];
        if (headerValue == null) {
          return false;
        }
        if (value == null) {
          return true;
        }
        // TODO: if value is a regex
        return headerValue === value;
      }

    }

    return false;

  }


  checkFilesystem(routeMatcherContext: RouteMatcherContext) {

  }

  routeMainLoop(routeMatcherContext: RouteMatcherContext) {

    let phase: HandleValue | null = null;

    while(true) {
      const results = this.doPhaseRoutes(phase, routeMatcherContext);

      // if result has check
      if (phase != null && results) {
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

        this.doPhaseRoutes('hit', routeMatcherContext);
        // can't have check
        // can't have status, can't specify dest
        // items will all have continue: true
        if (matched) {
          throw "unexpected";
        }

        // serve it and end

      } else {

        this.doPhaseRoutes('miss', routeMatcherContext);
        // if matches, then it has a dest and check
        if (matched) {
          // check for dest and check
          // throw if not present

          phase = 'rewrite';
          continue;
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

  doPhaseRoutes(phase: HandleValue | null, routeMatcherContext: RouteMatcherContext) {

    const results: RouteMatchResult[] = [];

    const phaseRoutes = this._routesCollection.getPhaseRoutes(phase);

    for (const [index, route] of phaseRoutes.entries()) {

      if (isHandler(route)) {
        // We don't expect any Handle, only Source routes
        continue;
      }

      const matchResult = this.matchRoute(route, routeMatcherContext);

      if (!matchResult) {
        continue;
      }

      if (route.middlewarePath != null) {
        // apply Edge middleware
      } else {
        // apply dest, headers, status

        // apply middleware or
        // apply dest, headers, status

        let destPathname = routeMatcherContext.pathname;
        if (route.dest != null) {
          destPathname = resolveRouteParameters(route.dest, matchResult.match, matchResult.keys);
        }

      }

      if (!route.continue) {
        break;
      }

    }

    return results;

  }

}

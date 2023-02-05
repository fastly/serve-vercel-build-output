import { RouteWithSrc } from "@vercel/routing-utils";
import { RouteMatcherContext } from "../routing/RouteMatcherContext";
import { RouteSrcMatcher, RouteSrcMatchResult } from "../routing/RouteSrcMatcher";
import { HasFieldEntry } from "../types/server";
import { PhaseResult, RouteMatchResult } from "../types/routing";
import { formatQueryString, parseQueryString } from "./query";

export function testRoute(route: RouteWithSrc, routeMatcherContext: RouteMatcherContext): RouteSrcMatchResult | false {

  const { methods, has, missing } = route;

  // methods
  if (Array.isArray(methods) &&
    !methods.includes(routeMatcherContext.method)
  ) {
    return false;
  }

  // has
  if (Array.isArray(has) &&
    !has.every(hasField => matchHasField(hasField, routeMatcherContext))
  ) {
    return false;
  }

  // missing
  if (Array.isArray(missing) &&
    missing.some(hasField => matchHasField(hasField, routeMatcherContext))
  ) {
    return false;
  }

  const matchResult = RouteSrcMatcher.exec(route, routeMatcherContext.pathname);
  if (matchResult == null) {
    return false;
  }

  return matchResult;

}

function matchHasField(
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

export function applyRouteResults(
  routeMatchResult: RouteMatchResult,
  phaseResult: PhaseResult,
  routeMatcherContext: RouteMatcherContext,
) {

  const { status, requestHeaders, headers, dest, isDestUrl, isCheck, middlewareResponse, } = routeMatchResult;

  if (status != null) {
    phaseResult.status = status;
  }

  if (requestHeaders != null) {
    if (routeMatcherContext.headers == null) {
      routeMatcherContext.headers = {};
    }
    if (phaseResult.requestHeaders == null) {
      phaseResult.requestHeaders = {};
    }
    for (const [key, value] of Object.entries(requestHeaders)) {
      routeMatcherContext.headers[key.toLowerCase()] = value;
      phaseResult.requestHeaders[key.toLowerCase()] = value;
    }
  }

  if (headers != null) {
    if (phaseResult.headers == null) {
      phaseResult.headers = {};
    }
    for (const [key, valuesAndReplacements] of Object.entries(headers)) {
      phaseResult.headers[key.toLowerCase()] = valuesAndReplacements.finalValue;
    }
  }

  if (dest != null) {
    let destPath = dest.finalValue;

    let destUrl: URL;
    if (!isURL(dest.finalValue) && !destPath.startsWith('/')) {
      // If it's not a full URL, then make sure it starts with a slash
      destPath = `/${destPath}`;
    }
    destUrl = new URL(destPath, routeMatcherContext.url);

    // Merge in the query params
    const origQuery = routeMatcherContext.query;
    const destQuery = parseQueryString(destUrl.search);
    const combinedQuery = Object.assign({}, destQuery, origQuery);
    destUrl.search = formatQueryString(combinedQuery) ?? '';

    routeMatcherContext.url = destUrl;
    phaseResult.dest = isDestUrl ? String(destUrl) : destUrl.pathname + destUrl.search;
  }

  if (isDestUrl) {
    phaseResult.isDestUrl = true;
  }

  if (isCheck) {
    phaseResult.isCheck = true;
  }

  if (middlewareResponse != null) {
    phaseResult.middlewareResponse = middlewareResponse;
  }
}

/**
 * A naive isURL
 */
export function isURL(str: any): boolean {
  return typeof str === 'string' && /^https?:\/\//.test(str);
}

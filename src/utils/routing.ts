import { HandleValue, RouteWithSrc } from "@vercel/routing-utils";
import { RouteMatcherContext } from "../routing/RouteMatcherContext";
import { RouteSrcMatcher, RouteSrcMatchResult } from "../routing/RouteSrcMatcher";
import { HasFieldEntry } from "../types/server";
import {
  HttpHeadersConfig,
  MiddlewareHandler,
  PhaseResult,
  RouteMatchResult,
  ValuesAndReplacements
} from "../types/routing";
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



/**
 * matchRoute
 */
export async function matchRoute(
  phase: HandleValue | null,
  routeIndex: number,
  route: RouteWithSrc,
  routeMatcherContext: RouteMatcherContext,
  middlewareHandler?: MiddlewareHandler,
): Promise<RouteMatchResult | false> {

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

    const response = middlewareHandler != null ? await middlewareHandler(middlewarePath, routeMatcherContext) : { isContinue: true };

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

export function resolveRouteParameters(
  str: string,
  match: string[],
  keys: string[]
): ValuesAndReplacements {
  const finalValue = str.replace(/\$([1-9a-zA-Z]+)/g, (_, param) => {
    let matchIndex: number = keys.indexOf(param);
    if (matchIndex === -1) {
      // It's a number match, not a named capture
      matchIndex = parseInt(param, 10);
    } else {
      // For named captures, add one to the `keys` index to
      // match up with the RegExp group matches
      matchIndex++;
    }
    return match[matchIndex] || '';
  });

  const replacementTokens: Record<string, string> = {};
  for (const [index, key] of keys.entries()) {
    replacementTokens[`$${key}`] = match[index+1] ?? '';
  }
  for (const [index, value] of match.entries()) {
    replacementTokens[`$${index}`] = value;
  }

  return {
    originalValue: str,
    replacementTokens,
    finalValue,
  };
}

export function flattenValuesAndReplacements(
  valuesAndReplacements: ValuesAndReplacements,
) {
  return valuesAndReplacements.finalValue;
}

export function flattenValuesAndReplacementsObject(
  valuesAndReplacementsObject: Record<string, ValuesAndReplacements>,
) {
  const resultObject: Record<string, string> = {};
  for (const [key, value] of Object.entries(valuesAndReplacementsObject)) {
    resultObject[key] = flattenValuesAndReplacements(value);
  }
  return resultObject;
}

import { HandleValue, RouteWithSrc } from "@vercel/routing-utils";
import RouteSrcMatcher from "../routing/RouteSrcMatcher.js";
import {
  HttpHeaders,
  RouteMatcherContext,
  MiddlewareHandler,
} from "../types/routing.js";

type HasFieldEntry = NonNullable<RouteWithSrc['has']>[number];

export function testRoute(
  route: RouteWithSrc,
  routeMatcherContext: RouteMatcherContext,
  matchStatus = false
) {

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

  // status
  if (matchStatus && routeMatcherContext.status !== route.status) {
    return false;
  }

  const matchResult = RouteSrcMatcher.exec(route, routeMatcherContext.pathname);
  if (matchResult == null) {
    return false;
  }

  console.log({route, matchResult});

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
      const cookieValue = context.cookies[key.toLowerCase()];
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

/**
 * A naive isURL
 */
export function isURL(str: any): boolean {
  return typeof str === 'string' && /^https?:\/\//.test(str);
}


export function resolveRouteParameters(
  str: string,
  match: string[],
  keys: string[]
): string {
  const finalValue = str.replace(/\$([0-9a-zA-Z]+)/g, (_, param) => {
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
    if (index === 0) {
      // don't allow 0
      continue;
    }
    replacementTokens[`$${index}`] = value;
  }

  console.log('Performed replacement:', {
    originalValue: str,
    finalValue,
    replacementTokens
  });

  return finalValue;
}

/**
 * Given a URL as a string and a base URL it will make the URL relative
 * if the parsed protocol and host is the same as the one in the base
 * URL. Otherwise, it returns the same URL string.
 */
export function relativizeURL(url: string, base: string | URL) {
  const baseURL = typeof base === 'string' ? new URL(base) : base
  const relative = new URL(url, base)
  const origin = `${baseURL.protocol}//${baseURL.host}`
  return `${relative.protocol}//${relative.host}` === origin
    ? relative.toString().replace(origin, '')
    : relative.toString()
}

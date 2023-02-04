import { RouteWithSrc } from "@vercel/routing-utils";
import { RouteMatcherContext } from "../routing/RouteMatcherContext";
import { RouteSrcMatcher, RouteSrcMatchResult } from "../routing/RouteSrcMatcher";
import { HasFieldEntry } from "../types/server";

export function matchRoute(route: RouteWithSrc, routeMatcherContext: RouteMatcherContext): RouteSrcMatchResult | false {

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

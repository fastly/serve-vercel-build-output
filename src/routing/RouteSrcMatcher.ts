import PCRE from "pcre-to-regexp";
import { isHandler, Route, RouteWithSrc } from "@vercel/routing-utils";

type RegExpAndKeys = {
  matcher: RegExp,
  keys: string[],
};

export default class RouteSrcMatcher {

  static routeSrcToRegExpAndKeys: Map<string, RegExpAndKeys> = new Map<string, RegExpAndKeys>();

  static getRegExpAndKeys(route: RouteWithSrc) {

    let regExpAndKeys = this.routeSrcToRegExpAndKeys.get(route.src);

    if (regExpAndKeys == null) {
      const keys: string[] = [];
      const matcher = PCRE(`%${route.src}%`, keys);
      regExpAndKeys = {
        matcher,
        keys,
      };
      this.routeSrcToRegExpAndKeys.set(route.src, regExpAndKeys);
    }

    return regExpAndKeys;

  }

  static init(routes: Route[]) {
    for (const route of routes) {
      if (!isHandler(route)) {
        this.getRegExpAndKeys(route);
      }
    }
  }

  static exec(route: RouteWithSrc, path: string) {
    const { matcher, keys } = this.getRegExpAndKeys(route);

    const match =
      matcher.exec(path) || matcher.exec(path.substring(1));

    if (match == null) {
      return null;
    }

    return { match, keys };

  }

}

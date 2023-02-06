import PCRE from "pcre-to-regexp";
import { isHandler, Route, RouteWithSrc } from "@vercel/routing-utils";
import { ValuesAndReplacements } from "../types/routing";

export type RegExpAndKeys = {
  matcher: RegExp,
  keys: string[],
};

export type RouteSrcMatchResult = Exclude<ReturnType<typeof RouteSrcMatcher['exec']>, null>;

export class RouteSrcMatcher {

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

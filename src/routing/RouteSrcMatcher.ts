import PCRE from "pcre-to-regexp";
import { isHandler, Route, RouteWithSrc } from "@vercel/routing-utils";
import { ValuesAndReplacements } from "../types/routing";

export type RegExpAndKeys = {
  matcher: RegExp,
  keys: string[],
};

export type RouteSrcMatchResult = ReturnType<typeof RouteSrcMatcher['exec']>;

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

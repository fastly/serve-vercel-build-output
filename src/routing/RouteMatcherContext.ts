import cookie from 'cookie';
import { parseQueryString } from "../utils/query";

type Query = Record<string, string[]>;

export class RouteMatcherCookiesMap extends Map<string, string> {

  private headers: Headers;

  constructor(headers: Headers) {
    super();
    this.headers = headers;

    const cookieString = this.headers.get('Cookie');
    if (cookieString) {
      for (const [key, value] of Object.entries(cookie.parse(cookieString))) {
        super.set(key, value);
      }
    }
  }

}

export class RouteMatcherContext {

  method: string;

  pathname: string;

  headers: Headers;

  query: Query;

  get host(): string {
    return this.headers.get('host') ?? '';
  }

  _cookies: RouteMatcherCookiesMap | undefined;
  get cookies(): RouteMatcherCookiesMap {
    if (this._cookies == null) {
      this._cookies = new RouteMatcherCookiesMap(this.headers);
    }
    return this._cookies;
  }

  constructor(request: Request) {

    this.method = request.method;
    this.headers = new Headers(request.headers);

    const url = new URL(request.url);
    this.pathname = url.pathname;
    this.query = parseQueryString(url.search);

  }

}

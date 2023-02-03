import cookie from 'cookie';
import { headersToObject, parseQueryString } from "../utils";
import { HttpHeadersConfig, Query } from "../types/routing";

export class RouteMatcherCookiesMap extends Map<string, string> {

  private readonly headers: HttpHeadersConfig;

  constructor(headers: HttpHeadersConfig) {
    super();
    this.headers = headers;

    const cookieString = this.headers['Cookie'];
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

  headers: HttpHeadersConfig;

  query: Query;

  get host(): string {
    return this.headers['host'] ?? '';
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
    this.headers = headersToObject(request.headers);

    const url = new URL(request.url);
    this.pathname = url.pathname;
    this.query = parseQueryString(url.search);

  }

}

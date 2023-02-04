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

type RouteMatcherContextInit = {
  method: string;
  pathname: string;
  headers: HttpHeadersConfig;
  query: Query;
};

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

  constructor(init: RouteMatcherContextInit) {

    this.method = init.method;
    this.headers = init.headers;
    this.pathname = init.pathname;
    this.query = init.query;
    this._cookies = undefined;

  }

  static fromRequest(request: Request) {

    const url = new URL(request.url);
    return new RouteMatcherContext({
      method: request.method,
      headers: headersToObject(request.headers),
      pathname: url.pathname,
      query: parseQueryString(url.search),
    });

  }

  static fromUrl(requestUrl: string, method = 'GET') {

    const url = new URL(requestUrl);
    return new RouteMatcherContext({
      method,
      headers: {},
      pathname: url.pathname,
      query: parseQueryString(url.search),
    });

  }

}

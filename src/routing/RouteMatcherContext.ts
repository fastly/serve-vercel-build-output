import cookie from 'cookie';
import { formatQueryString, headersToObject, parseQueryString } from "../utils/query";
import { HttpHeaders, Query } from "../types/routing";
import {arrayToReadableStream, readableStreamToArray} from "../utils/stream";

export class RouteMatcherCookiesMap extends Map<string, string> {

  private readonly headers: HttpHeaders;

  constructor(headers: HttpHeaders) {
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

type RouteMatcherContextInit_ = {
  method: string;
  url: string | URL;
  headers: HttpHeaders;
  body?: BodyInit | null;
};

type UrlInit = {
  method?: string;
  headers?: HttpHeaders;
  body?: BodyInit | null;
};

export interface RouteMatcherContext {

  // The method of the request, in uppercase
  method: string;

  // The pathname of the request, including the initial slash
  pathname: string;

  // The query part of the request, if it's not empty, including the initial question mark.
  // If it's empty, then this is the emptry string.
  query: string;

  // Headers of the request, as key-value pairs
  // Multiple values in a single header is listed as a single string, as comma-separated values.
  headers: HttpHeaders;

  // Body of the request, if not GET or HEAD
  body: Promise<Uint8Array> | null;

}

class RouteMatcherFromRequest implements RouteMatcherContext {

  method: string;
  pathname: string;
  query: string;
  headers: HttpHeaders;

  private readonly _requestBody: ReadableStream<Uint8Array> | null;

  private _body: Promise<Uint8Array> | null | undefined;

  get body(): Promise<Uint8Array> | null {
    if (this._body === undefined) {
      this._body = this._requestBody != null ? readableStreamToArray(this._requestBody) : null;
    }
    return this._body;
  }

  constructor(
    request: Request
  ) {
    const _request = request.clone();

    this.method = _request.method;
    const url = new URL(_request.url);
    this.pathname = url.pathname;
    this.query = url.search;
    this.headers = headersToObject(_request.headers);

    this._requestBody = _request.body;
    this._body = undefined;
  }

}

export function requestToRouteMatcherContext(request: Request): RouteMatcherContext {
  return new RouteMatcherFromRequest(request);
}

export function routeMatcherContextToRequest(routeMatcherContext: RouteMatcherContext, base: string): Request {

  const url = new URL(routeMatcherContext.pathname, base);
  url.search = routeMatcherContext.query;

  const body = routeMatcherContext.body != null ? arrayToReadableStream(routeMatcherContext.body) : null;

  return new Request(url, {
    method: routeMatcherContext.method,
    headers: routeMatcherContext.headers,
    body,
  });

}

export default class RouteMatcherContext_ {

  method: string;

  _url: URL;
  get url(): URL {
    return this._url;
  }

  set url(value: URL) {
    this._url = value;
  }

  get query(): Query {
    return parseQueryString(this._url.search);
  }

  set query(value: Query) {
    this._url.search = formatQueryString(value) ?? '';
  }

  get pathname(): string {
    return this._url.pathname;
  }

  set pathname(value: string) {
    this._url.pathname = value;
  }

  _headers: HttpHeaders;
  get headers(): HttpHeaders {
    return this._headers;
  }

  set headers(value: HttpHeaders) {
    this._cookies = undefined;
    this._headers = value;
  }

  get host(): string {
    return this._headers['host'] ?? '';
  }

  _cookies: RouteMatcherCookiesMap | undefined;
  get cookies(): RouteMatcherCookiesMap {
    if (this._cookies == null) {
      this._cookies = new RouteMatcherCookiesMap(this.headers);
    }
    return this._cookies;
  }

  body: BodyInit | null;

  constructor(init: RouteMatcherContextInit_) {

    this.method = init.method;

    this._headers = init.headers;
    this._cookies = undefined;

    this._url = new URL(String(init.url));

    this.body = init.body ?? null;

  }

  static fromRequest(request: Request) {

    return new RouteMatcherContext_({
      method: request.method,
      headers: headersToObject(request.headers),
      url: request.url,
      body: request.body,
    });

  }

  static fromUrl<TContext>(requestUrl: string, init: UrlInit = {}) {

    const {
      method = 'GET',
      headers = {},
      body,
    } = init;

    return new RouteMatcherContext_({
      method,
      headers,
      url: requestUrl,
      body: body ?? null,
    });

  }

  toRequest(): Request {

    return new Request(
      this.url,
      {
        method: this.method,
        headers: this.headers,
        body: this.body,
      }
    );

  }

}

import cookie from 'cookie';
import { formatQueryString, headersToObject, parseQueryString } from "../utils/query";
import { HttpCookies, HttpHeaders, Query } from "../types/routing";
import { arrayToReadableStream, readableStreamToArray } from "../utils/stream";
import { isURL } from "../utils/routing";

export interface RouteMatcherContext {

  // The method of the request, in uppercase
  get method(): string;

  // The host header of the request
  get host(): string;

  // The pathname of the request, including the initial slash
  get pathname(): string;

  // The query part of the request, as an object.
  // Each key maps to an array of string values.
  get query(): Query;

  // Headers of the request, as key-value pairs.
  // Multiple values in a single header is listed as a single string, as comma-separated values.
  get headers(): HttpHeaders;

  // Cookies of the request, as key-value pairs.
  get cookies(): HttpCookies;

  dest: string;

  // Body of the request, if not GET or HEAD
  body: Promise<Uint8Array> | null;

}

class RouteMatcherFromRequest implements RouteMatcherContext {

  private _method: string;

  get method() {
    return this._method;
  }

  private _host: string;

  get host() {
    return this._host;
  }

  private _pathname: string;

  get pathname() {
    return this._pathname;
  }

  private _query: Query;

  get query() {
    return this._query;
  }

  private readonly _headers: HttpHeaders;

  get headers() {
    return this._headers;
  }

  private readonly _cookies: HttpCookies;

  get cookies() {
    return this._cookies;
  }

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

    this._method = _request.method;
    this._headers = headersToObject(_request.headers);
    this._host = this._headers['host'];

    this._pathname = '';
    this._query = Object.create(null);

    const url = new URL(_request.url);
    this.applyUrl(url);

    if (this._headers['cookie']) {
      this._cookies = cookie.parse(this._headers['cookie']);
    } else {
      this._cookies = Object.create(null);
    }

    this._requestBody = _request.body;
    this._body = undefined;
  }

  applyUrl(
    url: URL
  ) {
    this._pathname = url.pathname;
    this._query = parseQueryString(url.search);

    if (!Boolean(this._headers['host'])) {
      this._host = url.host;
    }
  }

  set dest(value: string) {
    let destUrl: URL;

    if (isURL(value)) {
      // This is a full URL
      destUrl = new URL(value);
    } else {
      destUrl = new URL(
        value,
        routeMatcherContextBaseUrl(this)
      );
    }

    // Merge in the query params
    const destQuery = parseQueryString(destUrl.search);
    //TODO: Really? req overwrites?
    const combinedQuery = Object.assign({}, destQuery, this.query);
    destUrl.search = formatQueryString(combinedQuery) ?? '';

    this.applyUrl(destUrl);
  }

  get dest(): string {
    return this.pathname + (formatQueryString(this.query) ?? '');
  }

}

export function requestToRouteMatcherContext(request: Request): RouteMatcherContext {
  return new RouteMatcherFromRequest(request);
}

export function routeMatcherContextToRequest(routeMatcherContext: RouteMatcherContext): Request {

  const url = routeMatcherContextToUrl(routeMatcherContext);
  const body = routeMatcherContext.body != null ? arrayToReadableStream(routeMatcherContext.body) : null;

  return new Request(url, {
    method: routeMatcherContext.method,
    headers: routeMatcherContext.headers,
    body,
  });

}

export function routeMatcherContextBaseUrl(routeMatcherContext: RouteMatcherContext) {
  let proto = 'https';
  if (
    routeMatcherContext.host === 'localhost' || routeMatcherContext.host === '127.0.0.1'
  ) {
    proto = 'http';
  }

  return proto + '://' + routeMatcherContext.host;
}

export function routeMatcherContextToUrl(routeMatcherContext: RouteMatcherContext) {

  const url = new URL(
    routeMatcherContext.pathname,
    routeMatcherContextBaseUrl(routeMatcherContext)
  );
  url.search = formatQueryString(routeMatcherContext.query) ?? '';

  return url;

}



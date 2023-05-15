import cookie from 'cookie';
import {
  HttpCookies,
  HttpHeaders,
  QueryParams,
  RouteMatcherContext,
} from "../types/routing.js";
import { formatQueryString, headersToObject, parseQueryString } from "../utils/query.js";
import { arrayToReadableStream, readableStreamToArray } from "../utils/stream.js";
import { isURL } from "../utils/routing.js";
import { normalizeUrlLocalhost } from "../utils/request.js";

const hasOwnProperty = Object.prototype.hasOwnProperty;

class RouteMatcherContextFromRequest implements RouteMatcherContext {

  private readonly _method: string;
  private _host: string;
  private _pathname: string;
  private _query: QueryParams;
  private readonly _requestHeaders: HttpHeaders;
  private readonly _requestCookies: HttpCookies;
  private readonly _requestBody: ReadableStream<Uint8Array> | null;
  private _bodyPromise: Promise<Uint8Array> | undefined;

  private _responseStatus: number | undefined;
  private readonly _responseHeaders: HttpHeaders;

  private _initialPathname: string;
  private _initialQuery: QueryParams;

  constructor(
    request: Request
  ) {
    this._method = request.method;
    this._requestHeaders = headersToObject(request.headers);

    const url = new URL(normalizeUrlLocalhost(request.url));
    this._pathname = url.pathname;
    this._query = parseQueryString(url.search);
    this._host = url.host;

    if (this._requestHeaders['cookie']) {
      this._requestCookies = cookie.parse(this._requestHeaders['cookie']);
    } else {
      this._requestCookies = Object.create(null);
    }

    this._requestBody = null;
    if (this._method !== 'HEAD' && this._method !== 'GET') {
      this._requestBody = request.body;
    }
    this._bodyPromise = undefined;

    this._responseStatus = undefined;
    this._responseHeaders = Object.create(null);

    this._initialPathname = this._pathname;
    this._initialQuery = Object.assign(
      Object.create(null),
      this._query
    );
  }

  get method() {
    return this._method;
  }

  get host() {
    return this._host;
  }

  get pathname() {
    return this._pathname;
  }

  get query() {
    return this._query;
  }

  get headers() {
    return this._requestHeaders;
  }

  setRequestHeader(key: string, value: string) {
    this._requestHeaders[key] = value;
  }

  get cookies() {
    return this._requestCookies;
  }

  get body(): Promise<Uint8Array> | null {
    if (this._requestBody == null) {
      return null;
    }
    if (this._bodyPromise === undefined) {
      this._bodyPromise = readableStreamToArray(this._requestBody);
    }
    return this._bodyPromise;
  }

  get status() {
    return this._responseStatus;
  }

  setStatus(value: number) {
    this._responseStatus = value;
  }

  get responseHeaders() {
    return this._responseHeaders;
  }

  setResponseHeader(key: string, value: string, replace: boolean) {
    if (!replace && hasOwnProperty.call(this._responseHeaders, key)) {
      return;
    }
    this._responseHeaders[key] = value;
  }

  setDest(value: string) {
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

    this._pathname = destUrl.pathname;
    this._query = parseQueryString(destUrl.search);
    this._host = destUrl.host;
  }

  reset() {
    this._pathname = this._initialPathname;
    this._query = Object.assign(
      Object.create(null),
      this._initialQuery
    );
  }
}


export function createRouteMatcherContext(input: RequestInfo | URL, init?: RequestInit): RouteMatcherContext {

  const request = (input instanceof Request && init == null) ?
    input.clone() :
    new Request(input, init);

  return new RouteMatcherContextFromRequest(request);

}

export function requestToRouteMatcherContext(request: Request): RouteMatcherContext {
  return createRouteMatcherContext(request);
}

export function routeMatcherContextToRequest(routeMatcherContext: RouteMatcherContext): Request {
  const url = routeMatcherContextToUrl(routeMatcherContext);

  const requestInit: RequestInit = {
    method: routeMatcherContext.method,
    headers: routeMatcherContext.headers,
  };

  if (routeMatcherContext.body != null) {
    requestInit.body = arrayToReadableStream(routeMatcherContext.body);
  }

  return new Request(url, requestInit);
}

export function routeMatcherContextBaseUrl(routeMatcherContext: RouteMatcherContext) {
  let proto = 'https';
  if (
    routeMatcherContext.host === 'localhost' ||
    routeMatcherContext.host.startsWith('localhost:') ||
    routeMatcherContext.host === '127.0.0.1' ||
    routeMatcherContext.host.startsWith('127.0.0.1:')
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



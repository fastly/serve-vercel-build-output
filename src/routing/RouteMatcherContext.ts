import cookie from 'cookie';
import { formatQueryString, headersToObject, parseQueryString } from "../utils";
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
  url: string | URL;
  headers: HttpHeadersConfig;
  body: ReadableStream<Uint8Array> | null;
};

export type RequestBuilder = (input: URL | RequestInfo, init: RequestInit) => Request;

function defaultRequestBuilder(input: URL | RequestInfo, init: RequestInit) {
  return new Request(input, init);
}

export class RouteMatcherContext {

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

  _headers: HttpHeadersConfig;
  get headers(): HttpHeadersConfig {
    return this._headers;
  }

  set headers(value: HttpHeadersConfig) {
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

  body: ReadableStream<Uint8Array> | null;

  constructor(init: RouteMatcherContextInit) {

    this.method = init.method;

    this._headers = init.headers;
    this._cookies = undefined;

    this._url = new URL(String(init.url));

    this.body = init.body;

  }

  static fromRequest(request: Request) {

    return new RouteMatcherContext({
      method: request.method,
      headers: headersToObject(request.headers),
      url: request.url,
      body: request.body,
    });

  }

  static fromUrl(requestUrl: string, method = 'GET') {

    return new RouteMatcherContext({
      method,
      headers: {},
      url: requestUrl,
      body: null,
    });

  }

  toRequest(builder: RequestBuilder = defaultRequestBuilder): Request {

    return builder(
      this.pathname,
      {
        method: this.method,
        headers: this.headers,
        body: this.body,
      }
    );

  }

}

import { env } from "fastly:env";
import { AssetsMap } from "@fastly/compute-js-static-publish";
import { Config } from "../types/config";
import VercelBuildOutputTemplateEngine from "../templating/VercelBuildOutputTemplateEngine";
import AssetsCollection from "../assets/AssetsCollection";
import RoutesCollection from "../routing/RoutesCollection";
import RouteSrcMatcher from "../routing/RouteSrcMatcher";
import { HttpHeaders, RouterResultDest, RouterResultMiddleware } from "../types/routing";
import { Backends, BackendsDefs, EdgeFunction, EdgeFunctionContext, RequestContext } from "./types";
import RouteMatcherContext_ from "../routing/RouteMatcherContext";
import FunctionAsset from "../assets/FunctionAsset";
import StaticBinaryAsset from "../assets/StaticBinaryAsset";
import StaticStringAsset from "../assets/StaticStringAsset";
import RouteMatcher from "../routing/RouteMatcher";
import { processMiddlewareResponse } from "../utils/middleware";
import ILogger from "../logging/ILogger";
import { headersToObject } from "../utils/query";
import ILoggerProvider from "../logging/ILoggerProvider";
import { getBackendInfo } from "../utils/backends";
import { generateRequestId } from "../utils";
import { generateErrorMessage, generateHttpStatusDescription } from "../utils/errors";

export type ServerInit = {
  modulePath?: string,
  assets: AssetsMap,
  config: Config,
  backends?: BackendsDefs,
};

const REGEX_LOCALHOST_HOSTNAME = /(?!^https?:\/\/)(127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}|::1|localhost)/;
export function parseURL(url: string | URL, base?: string | URL) {
  return new URL(String(url).replace(REGEX_LOCALHOST_HOSTNAME, "localhost"), base && String(base).replace(REGEX_LOCALHOST_HOSTNAME, "localhost"));
}

export default class VercelBuildOutputServer {

  _templateEngine: VercelBuildOutputTemplateEngine;

  _assetsCollection: AssetsCollection;

  _routesCollection: RoutesCollection;

  _backends: Backends | 'dynamic';

  _loggerProvider?: ILoggerProvider;

  _logger?: ILogger;

  constructor(
    init: ServerInit,
    loggerProvider?: ILoggerProvider
  ) {
    const config = init.config;

    const routes = config.routes ?? [];

    this._routesCollection = new RoutesCollection(routes);
    RouteSrcMatcher.init(this._routesCollection.routes);

    this._templateEngine = new VercelBuildOutputTemplateEngine(init.modulePath);
    this._assetsCollection = new AssetsCollection(init.assets, config.overrides);

    this._backends = {};
    if (init.backends === 'dynamic') {
      this._backends = 'dynamic';
    } else if (init.backends != null) {
      for (const [key, def] of Object.entries(init.backends)) {
        let backend = def;
        if (typeof backend === 'string') {
          backend = {
            url: backend
          };
        }
        this._backends[key] = backend;
      }
    }

    this._loggerProvider = loggerProvider;
    this._logger = loggerProvider?.getLogger(this.constructor.name);
  }

  public createHandler() {

    return (event: FetchEvent) => {

      return this.serveRequest(
        event.request,
        event.client,
        {
          waitUntil: event.waitUntil.bind(event),
        },
      );
    };

  }

  public async serveRequest(
    request: Request,
    client: ClientInfo,
    edgeFunctionContext: EdgeFunctionContext,
  ): Promise<Response> {

    const initUrl = parseURL(request.url);

    // Fastly: build requestId from POP ID
    const requestId = generateRequestId(env('FASTLY_POP') || 'local');

    const requestContext: RequestContext = {
      client,
      requestId,
      initUrl,
      edgeFunctionContext,
    };

    const routeMatcherContext = RouteMatcherContext_.fromRequest(request);

    this._logger?.debug('requestContext', {
      requestContext
    });
    this._logger?.debug('routeMatcherContext', {
      method: routeMatcherContext.method,
      host: routeMatcherContext.host,
      pathname: routeMatcherContext.pathname,
      headers: routeMatcherContext.headers,
      query: routeMatcherContext.query,
    });

    this._logger?.info('calling router');
    const routeMatcher = new RouteMatcher(
      this._routesCollection,
      this._loggerProvider
    );
    routeMatcher.onCheckFilesystem =
      pathname => this.onCheckFilesystem(pathname);
    routeMatcher.onMiddleware = (middlewarePath, routeMatcherContext) =>
      this.onMiddleware(middlewarePath, initUrl, routeMatcherContext, edgeFunctionContext);
    const routeMatchResult = await routeMatcher.doRouter(routeMatcherContext);
    this._logger?.info('returned from router');

    this._logger?.debug('routeMatchResult', routeMatchResult);

    this._logger?.info('routeMatchResult.type', routeMatchResult.type);
    if (routeMatchResult.type === 'middleware') {
      return this.serveMiddlewareResponse(routeMatchResult);
    }

    if (routeMatchResult.type === 'proxy') {
      return this.serveProxyResponse(
        routeMatchResult,
        routeMatcherContext,
        client,
      );
    }

    if (routeMatchResult.type === 'redirect') {
      return await this.sendRedirect(
        request,
        requestId,
        routeMatchResult.dest,
        routeMatchResult.status,
      );
    }

    if (routeMatchResult.type === 'error') {
      return await this.sendError(
        request,
        requestId,
        '',
        routeMatchResult.status,
        routeMatchResult.headers,
      );
    }

    if (routeMatchResult.type === 'filesystem') {
      return await this.serveFilesystem(
        routeMatchResult,
        routeMatcherContext,
        edgeFunctionContext,
      );
    }

    return this.serveErrorResponse();
  }

  private serveMiddlewareResponse(
    routeMatchResult: RouterResultMiddleware
  ) {
    this._logger?.debug('Serving response from middleware');
    this._logger?.debug({
      status: routeMatchResult.middlewareResponse.status,
      headers: headersToObject(routeMatchResult.middlewareResponse.headers),
    });

    return routeMatchResult.middlewareResponse;
  }

  private serveProxyResponse(
    routeMatchResult: RouterResultDest,
    routeMatcherContext: RouteMatcherContext_,
    client: ClientInfo,
  ) {
    this._logger?.debug('Serving proxy response');

    const requestInit: RequestInit = {};

    if (routeMatcherContext.body != null) {
      // TODO: we have to clone here maybe
      requestInit.body = routeMatcherContext.body;
    }

    const headers = Object.assign({}, routeMatcherContext.headers);

    // rewrite host
    headers['host'] = new URL(routeMatchResult.dest).host;

    // XFF
    const url = routeMatcherContext.url;
    const port = url.port || '443';       // C@E can only be on 443, except when running locally
    const proto = 'https';                // C@E can only be accessed via HTTPS

    const values: Record<string, string> = {
      for: client.address ?? 'localhost',
      port,
      proto,
    };

    ['for', 'port', 'proto'].forEach(function(header) {
      const arr: string[] = [];
      let strs = headers['x-forwarded-' + header];
      if(Array.isArray(strs)) {
        strs = strs.join(',');
      }
      if(strs) {
        arr.push(strs);
      }
      arr.push(values[header]);
      headers['x-forwarded-' + header] = arr.join(',');
    });

    if (this._backends !== 'dynamic') {
      const backendInfo = getBackendInfo(this._backends, routeMatchResult.dest);

      if (backendInfo == null) {
        this._logger?.warn('Proxying to ' + routeMatchResult.dest + ' may fail as it does not match a defined backend.');
      } else {
        requestInit.backend = backendInfo.name;

        // rewrite host to that of backend
        // TODO: maybe make this configurable?
        headers['host'] = new URL(backendInfo.url).host;
      }
    }

    requestInit.headers = new Headers(headers);

    this._logger?.debug('Making proxy request to', routeMatchResult.dest);
    this._logger?.debug({
      backend: requestInit.backend,
      headers,
    });

    return fetch(routeMatchResult.dest, requestInit);
  }

  private buildResponseHeaders(
    headers: HttpHeaders,
    requestId: string,
  ): HttpHeaders {
    return {
      'cache-control': 'public, max-age=0, must-revalidate',
      ...headers,
      server: 'Vercel',
      'x-vercel-id': requestId,
      'x-vercel-cache': 'MISS',
    };
  }

  private async sendRedirect(
    request: Request,
    requestId: string,
    location: string,
    statusCode: number = 302,
  ) {
    this._logger?.debug(`Serving redirect ${statusCode}: ${location}`);

    const headers = this.buildResponseHeaders(
      { location },
      requestId,
    );

    let body: string;
    const accept = request.headers.get('accept') ?? 'text/plain';
    if (accept.includes('json')) {
      headers['content-type'] = 'application/json';
      const json = JSON.stringify({
        redirect: location,
        status: String(statusCode),
      });
      body = `${json}\n`;
    } else if (accept.includes('html')) {
      headers['content-type'] = 'text/html';
      body = this._templateEngine.redirectTemplate({ location, statusCode });
    } else {
      headers['content-type'] = 'text/plain';
      body = `Redirecting to ${location} (${statusCode})\n`;
    }

    return new Response(body, {
      status: statusCode,
      headers,
    });
  }

  private async sendError(
    request: Request,
    requestId: string,
    errorCode?: string,
    statusCode: number = 500,
    additionalHeaders: HttpHeaders = {},
  ) {

    const headers = this.buildResponseHeaders(
      additionalHeaders,
      requestId,
    );

    const http_status_description = generateHttpStatusDescription(statusCode);
    const error_code = errorCode || http_status_description;
    const errorMessage = generateErrorMessage(statusCode, error_code);

    let body: string;
    const accept = request.headers.get('accept') ?? 'text/plain';
    if (accept.includes('json')) {
      headers['content-type'] = 'application/json';
      const json = JSON.stringify({
        error: {
          code: statusCode,
          message: errorMessage.title,
        },
      });
      body = `${json}\n`;
    } else if (accept.includes('html')) {
      headers['content-type'] = 'text/html; charset=utf-8';

      let view: string;
      if (statusCode === 404) {
        view = this._templateEngine.errorTemplate404({
          ...errorMessage,
          http_status_code: statusCode,
          http_status_description,
          error_code,
          request_id: requestId,
        });
      } else if (statusCode === 502) {
        view = this._templateEngine.errorTemplate502({
          ...errorMessage,
          http_status_code: statusCode,
          http_status_description,
          error_code,
          request_id: requestId,
        });
      } else {
        view = this._templateEngine.errorTemplate({
          http_status_code: statusCode,
          http_status_description,
          error_code,
          request_id: requestId,
        });
      }
      body = this._templateEngine.errorTemplateBase({
        http_status_code: statusCode,
        http_status_description,
        view,
      });
    } else {
      headers['content-type'] = 'text/plain; charset=utf-8';
      body = `${errorMessage.title}\n\n${error_code}\n`;
    }

    return new Response(body, {
      status: statusCode,
      headers,
    });
  }

  private async serveFilesystem(
    routeMatchResult: RouterResultDest,
    routeMatcherContext: RouteMatcherContext_,
    edgeFunctionContext: EdgeFunctionContext,
  ) {
    const pathname = routeMatchResult.dest;

    const request = routeMatcherContext.toRequest();

    this._logger?.debug('Serving from filesystem');
    this._logger?.debug({
      dest: routeMatchResult.dest,
      pathname,
    });

    const asset = this._assetsCollection.getAsset(pathname);
    if (asset instanceof FunctionAsset) {
      const func = (await asset.loadModule()).default as EdgeFunction;
      return func(request, edgeFunctionContext);
    }
    if (asset instanceof StaticBinaryAsset || asset instanceof StaticStringAsset) {
      return new Response(asset.content, {
        status: 200,
        headers: {
          'Content-Type': asset.contentType,
        },
      });
    }
    if (asset == null) {
      throw new Error(`Unknown asset: ${pathname}`);
    }
    throw new Error('Unknown asset type ' + pathname);
  }

  private serveErrorResponse() {
    this._logger?.debug('Error response');

    return new Response('error', { 'headers': { 'content-type': 'text/plain' }});
  }

  onCheckFilesystem(pathname: string) {
    this._logger?.debug('onCheckFilesystem', {pathname});
    const result = this._assetsCollection.getAsset(pathname) != null;
    this._logger?.debug({result});
    return result;
  }

  async onMiddleware(
    middlewarePath: string,
    initUrl: URL,
    routeMatcherContext: RouteMatcherContext_,
    edgeFunctionContext: EdgeFunctionContext,
  ) {
    const asset = this._assetsCollection.getAsset(middlewarePath);
    if (!(asset instanceof FunctionAsset) || asset.vcConfig.runtime !== 'edge') {
      // not found (or wasn't a edge function)
      // TODO: should probably find a way to return an error.

      this._logger?.warn('Middleware ' + middlewarePath + ' not found (or not edge function), performing no-op');

      return {
        isContinue: true,
      };
    }

    const request = routeMatcherContext.toRequest();

    const func = (await asset.loadModule()).default as EdgeFunction;
    const response = await func(request, edgeFunctionContext);

    const result = processMiddlewareResponse(response, initUrl);
    this._logger?.debug({initUrl, result});
    return result;
  }
}

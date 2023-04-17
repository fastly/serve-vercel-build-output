import AssetsCollection from "../assets/AssetsCollection.js";
import RoutesCollection from "../routing/RoutesCollection.js";
import { Config } from "../types/config.js";
import RouteSrcMatcher from "../routing/RouteSrcMatcher.js";
import {
  createRouteMatcherContext,
  RouteMatcherContext,
  routeMatcherContextToRequest
} from "../routing/RouteMatcherContext.js";
import RouteMatcher from "../routing/RouteMatcher.js";
import { Backends, BackendsDefs, RequestContext } from "../server/types.js";
import { getLogger, ILogger } from "../logging/index.js";
import FunctionAsset from "../assets/FunctionAsset.js";
import { processMiddlewareResponse } from "../utils/middleware.js";
import { HttpHeaders, RouterResultSynthetic } from "../types/routing.js";
import { headersToObject } from "../utils/query.js";
import { arrayToReadableStream } from "../utils/stream.js";
import { getBackendInfo } from "../utils/backends.js";
import { generateErrorMessage, generateHttpStatusDescription } from "../utils/errors.js";
import VercelBuildOutputTemplateEngine from "../templating/VercelBuildOutputTemplateEngine.js";
import EdgeNetworkCacheStep from "./EdgeNetworkCacheStep.js";
import { execLayerProxy } from "../utils/execLayerProxy.js";

export type EdgeMiddlewareStepInit = {
  config: Config,
  templateEngine: VercelBuildOutputTemplateEngine,
  backends?: BackendsDefs,
  assetsCollection: AssetsCollection,
};

export default class EdgeMiddlewareStep {
  private _assetsCollection: AssetsCollection;
  private _routesCollection: RoutesCollection;
  private _backends: Backends | 'dynamic';
  private _templateEngine: VercelBuildOutputTemplateEngine;
  private _edgeNetworkCacheStep: EdgeNetworkCacheStep;
  private _logger?: ILogger;

  constructor(
    init: EdgeMiddlewareStepInit,
  ) {
    const config = init.config;

    const { assetsCollection } = init;

    this._assetsCollection = assetsCollection;

    const routes = config.routes ?? [];
    this._routesCollection = new RoutesCollection(routes);
    RouteSrcMatcher.init(this._routesCollection.routes);

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

    this._templateEngine = init.templateEngine;

    this._edgeNetworkCacheStep = new EdgeNetworkCacheStep({
      assetsCollection,
    });

    this._logger = getLogger(this.constructor.name);
  }

  async doStep(
    requestContext: RequestContext,
  ) {

    const { client, request, requestId, initUrl } = requestContext;

    const routeMatcherContext = createRouteMatcherContext(request);

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
    );
    routeMatcher.onCheckFilesystem =
      pathname => this.onCheckFilesystem(pathname);
    routeMatcher.onMiddleware = (middlewarePath, routeMatcherContext) =>
      this.onMiddleware(middlewarePath, initUrl, routeMatcherContext);
    const routeMatchResult = await routeMatcher.doRouter(routeMatcherContext);
    this._logger?.info('returned from router');

    this._logger?.debug('routeMatchResult', routeMatchResult);

    this._logger?.info('routeMatchResult.type', routeMatchResult.type);

    // TODO: Make sure that these responses get the headers and status applied to them

    if (routeMatchResult.type === 'synthetic') {
      return this.serveSyntheticResponse(
        routeMatchResult
      );
    }

    if (routeMatchResult.type === 'proxy') {
      return this.serveProxyResponse(
        routeMatchResult.dest,
        routeMatcherContext,
        request,
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

    if (routeMatchResult.type !== 'filesystem') {
      return this.serveErrorResponse();
    }

    return await this._edgeNetworkCacheStep.doStep(requestContext, routeMatcherContext, routeMatchResult.dest);

  }

  private serveSyntheticResponse(
    routeMatchResult: RouterResultSynthetic
  ) {
    this._logger?.debug('Serving response from middleware');
    this._logger?.debug({
      status: routeMatchResult.syntheticResponse.status,
      headers: headersToObject(routeMatchResult.syntheticResponse.headers),
    });

    return routeMatchResult.syntheticResponse;
  }

  private serveProxyResponse(
    pathname: string,
    routeMatcherContext: RouteMatcherContext,
    request: Request,
    client: ClientInfo,
  ) {
    this._logger?.debug('Serving proxy response');

    const requestInit: RequestInit = {};

    if (routeMatcherContext.body != null) {
      requestInit.body = arrayToReadableStream(routeMatcherContext.body);
    }

    const headers = Object.assign({}, routeMatcherContext.headers);

    // rewrite host
    headers['host'] = new URL(pathname).host;

    // XFF
    const url = new URL(request.url);
    const port = url.port || '443';       // C@E can only be on 443, except when running locally
    const proto = 'https';                // C@E can only be accessed via HTTPS

    const values: Record<string, string> = {
      host: url.host,
      for: client.address ?? 'localhost',
      port,
      proto,
    };

    ['host', 'for', 'port', 'proto'].forEach(function(header) {
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
      const backendInfo = getBackendInfo(this._backends, pathname);

      if (backendInfo == null) {
        this._logger?.warn('Proxying to ' + pathname + ' may fail as it does not match a defined backend.');
      } else {
        requestInit.backend = backendInfo.name;

        // rewrite host to that of backend, rather than the one in dest
        // TODO: maybe make this configurable?
        // headers['host'] = new URL(backendInfo.url).host;
      }
    }

    requestInit.headers = new Headers(headers);

    this._logger?.debug('Making proxy request to', pathname);
    this._logger?.debug({
      backend: requestInit.backend,
      headers,
    });

    return fetch(pathname, requestInit);
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
    routeMatcherContext: RouteMatcherContext,
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

    const request = routeMatcherContextToRequest(routeMatcherContext);

    const response = await execLayerProxy(request, middlewarePath);

    const result = processMiddlewareResponse(response, initUrl);
    this._logger?.debug({initUrl, result});
    return result;
  }
}

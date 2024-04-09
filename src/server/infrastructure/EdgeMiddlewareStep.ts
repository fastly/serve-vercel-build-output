import { CacheOverride } from "fastly:cache-override";
import RoutesCollection from "../routing/RoutesCollection.js";
import { Config } from "../types/config.js";
import RouteSrcMatcher from "../routing/RouteSrcMatcher.js";
import {
  routeMatcherContextToRequest
} from "../routing/RouteMatcherContext.js";
import RouteMatcher from "../routing/RouteMatcher.js";
import { RequestContext } from "../server/types.js";
import { getLogger, ILogger } from "../logging/index.js";
import FunctionAsset from "../assets/FunctionAsset.js";
import { processMiddlewareResponse } from "../utils/middleware.js";
import {HttpHeaders, RouteMatcherContext, RouterPhaseResult} from "../types/routing.js";
import { headersToObject } from "../utils/query.js";
import { arrayToReadableStream } from "../utils/stream.js";
import { getBackendInfo } from "../utils/backends.js";
import { generateErrorMessage, generateHttpStatusDescription } from "../utils/errors.js";
import EdgeNetworkCacheStep from "./EdgeNetworkCacheStep.js";
import { normalizeUrlLocalhost } from "../utils/request.js";
import VercelBuildOutputServer from "../server/VercelBuildOutputServer.js";

export type EdgeMiddlewareStepInit = {
  config: Config,
  vercelBuildOutputServer: VercelBuildOutputServer,
};

export default class EdgeMiddlewareStep {
  private _vercelBuildOutputServer: VercelBuildOutputServer;
  private _routesCollection: RoutesCollection;
  private _wildcardMap: Record<string, string>;
  private _edgeNetworkCacheStep: EdgeNetworkCacheStep;
  private _logger: ILogger;

  constructor(
    init: EdgeMiddlewareStepInit,
  ) {
    const {
      config,
      vercelBuildOutputServer,
    } = init;

    this._vercelBuildOutputServer = vercelBuildOutputServer;

    const routes = config.routes ?? [];
    this._routesCollection = new RoutesCollection(routes);
    RouteSrcMatcher.init(this._routesCollection.routes);

    this._wildcardMap = {};
    for (const wildcardEntry of config.wildcard ?? []) {
      this._wildcardMap[wildcardEntry.domain] = wildcardEntry.value;
    }

    this._edgeNetworkCacheStep = new EdgeNetworkCacheStep({
      vercelBuildOutputServer,
    });

    this._logger = getLogger(this.constructor.name);
  }

  async doStep(
    requestContext: RequestContext,
  ) {

    const { request } = requestContext;

    this._logger.debug('requestContext', {
      requestContext
    });

    const routeMatcher = new RouteMatcher(
      this._routesCollection,
      this._wildcardMap,
    );
    routeMatcher.onCheckFilesystem =
      pathname => this.onCheckFilesystem(pathname);
    routeMatcher.onMiddleware = (middlewarePath, routeMatcherContext) =>
      this.onMiddleware(requestContext, middlewarePath, routeMatcherContext);
    routeMatcher.onServeRouterResult = (routerResult, routeMatcherContext) =>
      this.serveRouterResult(requestContext, routerResult, routeMatcherContext);
    routeMatcher.onServeRouterError = (status, errorCode, routeMatcherContext) =>
      this.serveRouterError(requestContext, status, errorCode, routeMatcherContext)

    this._logger.info('calling router');
    const response = await routeMatcher.doRouter(request);
    this._logger.info('returned from router');

    return response;
  }

  public async serveRouterResult(
    requestContext: RequestContext,
    routerResult: RouterPhaseResult,
    routeMatcherContext: RouteMatcherContext,
  ) {

    const { client, request, requestId } = requestContext;

    let response: Response | undefined = undefined;

    if (routerResult.type === 'redirect') {
      response = await this.serveRedirect(
        request,
        routerResult.dest!,
        routerResult.status!,
      );
    } else if (routerResult.type === 'proxy') {
      response = await this.serveProxyResponse(
        routerResult.dest!, // Can't use routeMatcherContext.pathname here because this is a full URL
        request,
        client,
        routeMatcherContext.headers,
        routeMatcherContext.body,
      );
    } else if (routerResult.type === 'dest') {
      response = await this._edgeNetworkCacheStep.doStep(
        requestContext,
        routeMatcherContext,
        routerResult.originalDest,
        routerResult.routeMatches,
      );
    } else if (routerResult.type === 'synthetic') {
      if (routerResult.response == null) {
        throw new Error('Unexpected! routerResult.response is null for synthetic result');
      }
      response = this.serveSyntheticResult(
        routerResult.response
      );
    } else if (routerResult.type === 'error') {
      response = await this.serveError(
        request,
        requestId,
        routerResult.status,
        null,
      );
    } else {
      response = this.serveUnknownResultType();
    }

    return this.serveResponse(response, requestId,
      {
        ...routeMatcherContext.responseHeaders,
        ...routerResult.headers
      }
    );
  }

  public async serveRouterError(
    requestContext: RequestContext,
    status: number,
    errorCode: string | null = null,
    routeMatcherContext: RouteMatcherContext,
  ) {

    const { request, requestId } = requestContext;

    const response = await this.serveError(
      request,
      requestId,
      status,
      errorCode,
    );

    return this.serveResponse(response, requestId, routeMatcherContext.responseHeaders);

  }

  private serveResponse(
    response: Response,
    requestId: string,
    additionalHeaders?: HttpHeaders,
  ) {
    return new Response(response.body, {
      status: response.status ?? 200,
      headers: this.buildResponseHeaders({
        ...headersToObject(response.headers),
        ...additionalHeaders,
      }, requestId),
    });
  }

  private serveSyntheticResult(
    response: Response
  ) {
    this._logger.debug('Serving synthetic response');
    this._logger.debug({
      status: response.status,
      headers: headersToObject(response.headers),
    });

    return response;
  }

  private serveProxyResponse(
    destUrl: string,
    request: Request,
    client: ClientInfo,
    requestHeaders: HttpHeaders,
    body: Promise<Uint8Array> | null,
  ) {
    this._logger.debug('Serving proxy response');

    const requestInit: RequestInit = {};

    if (body != null) {
      requestInit.body = arrayToReadableStream(body);
    }

    const headers = Object.assign({}, requestHeaders);

    // rewrite host
    headers['host'] = new URL(normalizeUrlLocalhost(destUrl)).host;

    // XFF
    const url = new URL(normalizeUrlLocalhost(request.url));
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

    if (this._vercelBuildOutputServer.serverConfig.backends !== 'dynamic') {
      const backendInfo = getBackendInfo(this._vercelBuildOutputServer.serverConfig.backends, destUrl);

      if (backendInfo == null) {
        this._logger.warn('Proxying to ' + destUrl + ' may fail as it does not match a defined backend.');
      } else {
        requestInit.backend = backendInfo.name;

        // rewrite host to that of backend, rather than the one in dest
        // TODO: maybe make this configurable?
        // headers['host'] = new URL(backendInfo.url).host;
      }
    }

    requestInit.headers = new Headers(headers);

    this._logger.debug('Making proxy request to', destUrl);
    this._logger.debug({
      backend: requestInit.backend,
      headers,
    });

    return fetch(destUrl, requestInit);
  }

  private buildResponseHeaders(
    headers: HttpHeaders,
    requestId: string,
  ): HttpHeaders {

    const vercelCache = headers['x-vercel-cache'] ?? 'MISS';
    return {
      'cache-control': 'public, max-age=0, must-revalidate',
      ...headers,
      server: 'Vercel',
      'x-vercel-id': requestId,
      'x-vercel-cache': vercelCache,
    };
  }

  private async serveRedirect(
    request: Request,
    location: string,
    statusCode: number = 302,
  ) {
    this._logger.debug(`Serving redirect ${statusCode}: ${location}`);

    const headers: HttpHeaders = { location };

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
      body = this._vercelBuildOutputServer.templateEngine.redirectTemplate({ location, statusCode });
    } else {
      headers['content-type'] = 'text/plain';
      body = `Redirecting to ${location} (${statusCode})\n`;
    }

    return new Response(body, {
      status: statusCode,
      headers,
    });
  }

  private async serveError(
    request: Request,
    requestId: string,
    statusCode: number = 500,
    errorCode: string | null,
  ) {

    const headers: HttpHeaders = {};

    const http_status_description = generateHttpStatusDescription(statusCode);
    const error_code = errorCode ?? http_status_description;
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
        view = this._vercelBuildOutputServer.templateEngine.errorTemplate404({
          ...errorMessage,
          http_status_code: statusCode,
          http_status_description,
          error_code,
          request_id: requestId,
        });
      } else if (statusCode === 502) {
        view = this._vercelBuildOutputServer.templateEngine.errorTemplate502({
          ...errorMessage,
          http_status_code: statusCode,
          http_status_description,
          error_code,
          request_id: requestId,
        });
      } else {
        view = this._vercelBuildOutputServer.templateEngine.errorTemplate({
          http_status_code: statusCode,
          http_status_description,
          error_code,
          request_id: requestId,
        });
      }
      body = this._vercelBuildOutputServer.templateEngine.errorTemplateBase({
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

  private serveUnknownResultType() {
    this._logger.debug('Error response');

    return new Response('error', { 'headers': { 'content-type': 'text/plain' }});
  }

  onCheckFilesystem(pathname: string) {
    this._logger.debug('onCheckFilesystem', {pathname});
    const result = this._vercelBuildOutputServer.assetsCollection.getAsset(pathname) != null;
    this._logger.debug({result});
    return result;
  }

  async onMiddleware(
    requestContext: RequestContext,
    middlewarePath: string,
    routeMatcherContext: RouteMatcherContext,
  ) {
    const asset = this._vercelBuildOutputServer.assetsCollection.getAsset(middlewarePath);
    if (!(asset instanceof FunctionAsset) || asset.vcConfig.runtime !== 'edge') {
      // not found (or wasn't a edge function)
      // TODO: should probably find a way to return an error.

      this._logger.warn('Middleware ' + middlewarePath + ' not found (or not edge function), performing no-op');

      return {
        isContinue: true,
      };
    }

    this._logger.debug({routeMatcherContext});
    const middlewareRequest = routeMatcherContextToRequest(routeMatcherContext);
    middlewareRequest.headers.set('x-matched-path', middlewarePath);
    this._logger.debug({middlewareRequest});

    // Middleware always runs on every request, so we bypass the cache
    middlewareRequest.setCacheOverride(new CacheOverride("pass"));

    const { request, client, edgeFunctionContext } = requestContext;
    this._logger.debug('requestContext', request.url);

    const middlewareResponse =
      await this._vercelBuildOutputServer.vercelExecLayer.execFunction(
        middlewareRequest,
        client,
        edgeFunctionContext,
      );
    this._logger.debug({middlewareResponse});

    // Process response (including response headers, response body)
    const baseUrl = normalizeUrlLocalhost(request.url);
    this._logger.debug({baseUrl});
    const result = processMiddlewareResponse(middlewareResponse, baseUrl);
    this._logger.debug({result});
    return result;
  }
}

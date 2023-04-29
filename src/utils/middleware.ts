import { HttpHeaders, MiddlewareResponse } from "../types/routing.js";
import { relativizeURL } from "./routing.js";
import { normalizeUrlLocalhost } from "./request.js";
import { getLogger } from "../logging/index.js";

export function processMiddlewareResponse(response: Response, baseUrl: string): MiddlewareResponse {

  const logger = getLogger('middleware');

  let returnResponse = true;
  let isContinue = false;
  let status: number | undefined = undefined;
  let headers: HttpHeaders | undefined = undefined;
  let requestHeaders: HttpHeaders | undefined = undefined;
  let dest: string | undefined = undefined;

  // next - x-middleware-next. This is supposed to continue the middleware
  // chain. Currently Next seems to only allow you to
  // set request headers
  // set response cookies, and set response headers
  // you are not allowed to try to modify the response body here.
  const middlewareNextHeaderValue = response.headers.get('x-middleware-next');
  logger.debug({middlewareNextHeaderValue});
  if (middlewareNextHeaderValue === '1') {
    response.headers.delete('x-middleware-next');
    returnResponse = false;
    isContinue = true;
  }

  // redirect - Location header
  const locationHeader = response.headers.get('Location');
  logger.debug({locationHeader});
  if (locationHeader != null) {
    status = response.status;
    returnResponse = false;
  }

  // rewrite - x-middleware-rewrite
  const rewriteHeaderValue = response.headers.get('x-middleware-rewrite');
  logger.debug({rewriteHeaderValue});
  if (rewriteHeaderValue != null) {
    returnResponse = false;
    response.headers.delete('x-middleware-rewrite');
    dest = relativizeURL(normalizeUrlLocalhost(rewriteHeaderValue), baseUrl);
  }

  // request headers are set in NextResponse.request.headers
  // they are transferred to the headers:
  // x-middleware-request-
  // and
  // x-middleware-override-headers
  // set these on request headers before going to next
  const overrideHeaders = response.headers.get('x-middleware-override-headers');
  logger.debug('overrideHeaders');
  if (overrideHeaders != null) {
    response.headers.delete('x-middleware-override-headers');
    for (const key of overrideHeaders.split(',')) {
      const value = response.headers.get('x-middleware-request-' + key);
      logger.debug({key, value});
      if (value != null) {
        response.headers.delete('x-middleware-request-' + key);
        if (requestHeaders == null) {
          requestHeaders = {};
        }
        requestHeaders[key.toLowerCase()] = value;
      }
    }
  }

  // response headers/cookies are just on the headers
  // so apply them.
  for (const [key, value] of response.headers.entries()) {
    if (headers == null) {
      headers = {};
    }
    headers[key.toLowerCase()] = value;
  }

  if (returnResponse || response.status !== 200) {
    status = response.status;
  }

  return {
    status,
    dest,
    headers,
    requestHeaders,
    isContinue,
    response: returnResponse ? response : undefined,
  };

}

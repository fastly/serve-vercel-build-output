import { HttpHeadersConfig, MiddlewareResponse } from "../types/routing";
import { relativizeURL } from "./routing";

export function processMiddlewareResponse(response: Response, initUrl: string | URL): MiddlewareResponse {

  let returnResponse = true;
  let isContinue = false;
  let status: number | undefined = undefined;
  let headers: HttpHeadersConfig | undefined = undefined;
  let requestHeaders: HttpHeadersConfig | undefined = undefined;
  let dest: string | undefined = undefined;

  // next - x-middleware-next. This is supposed to continue the middleware
  // chain. Currently Next seems to only allow you to
  // set request headers
  // set response cookies, and set response headers
  // you are not allowed to try to modify the response body here.
  if (response.headers.get('x-middleware-next') === '1') {
    response.headers.delete('x-middleware-next');
    returnResponse = false;
    isContinue = true;
  }

  // redirect - Location header
  const locationHeader = response.headers.get('Location');
  if (locationHeader != null) {
    status = response.status;
    returnResponse = false;
  }

  // rewrite - x-middleware-rewrite
  const rewriteHeaderValue = response.headers.get('x-middleware-rewrite');
  if (rewriteHeaderValue != null) {
    returnResponse = false;
    response.headers.delete('x-middleware-rewrite');
    dest = relativizeURL(rewriteHeaderValue, initUrl);
  }

  // request headers are set in NextResponse.request.headers
  // they are transferred to the headers:
  // x-middleware-request-
  // and
  // x-middleware-override-headers
  // set these on request headers before going to next
  const overrideHeaders = response.headers.get('x-middleware-override-headers');
  if (overrideHeaders != null) {
    response.headers.delete('x-middleware-override-headers');
    for (const key of overrideHeaders.split(',')) {
      const value = response.headers.get('x-middleware-request-' + key);
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

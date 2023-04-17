import { cloneRequestWithNewUrl } from "./request.js";

const EXEC_LAYER_PATH_PREFIX = '/_xl';
const EXEC_LAYER_CALL_HEADER = 'x-xl-call';
const EXEC_LAYER_ORIG_REQUEST_PATHNAME = 'x-xl-orig-pathname';
const EXEC_LAYER_BACKEND = 'self';

export function isExecLayerPath(pathname: string) {
  return pathname.startsWith(EXEC_LAYER_PATH_PREFIX + '/');
}

export async function execLayerProxy(request: Request, functionPathname?: string) {
  const execLayerRequest = createExecLayerRequest(request, functionPathname);
  return fetch(execLayerRequest);
}

export function createExecLayerRequest(request: Request, functionPathname?: string) {

  const pathname = (new URL(request.url)).pathname;

  let requestPathname;
  let origPathname;
  if (functionPathname != null) {
    requestPathname = functionPathname;
    origPathname = pathname;
  } else {
    requestPathname = pathname;
    origPathname = undefined;
  }

  const execLayerRequest = cloneRequestWithNewUrl(
    request,
    toExecLayerPath(requestPathname),
    {
      backend: EXEC_LAYER_BACKEND,
    },
  );

  execLayerRequest.headers.set(EXEC_LAYER_CALL_HEADER, '1');
  if (origPathname != null) {
    execLayerRequest.headers.set(EXEC_LAYER_ORIG_REQUEST_PATHNAME, origPathname);
  }

  return execLayerRequest;
}

export function fromExecLayerRequest(execLayerRequest: Request) {

  let origPathname = execLayerRequest.headers.get(EXEC_LAYER_ORIG_REQUEST_PATHNAME);
  if (origPathname == null) {
    origPathname = fromExecLayerPath(new URL(execLayerRequest.url).pathname);
  }

  const request = cloneRequestWithNewUrl(
    execLayerRequest,
    origPathname,
  );

  request.headers.delete(EXEC_LAYER_CALL_HEADER);
  request.headers.delete(EXEC_LAYER_ORIG_REQUEST_PATHNAME);

  return request;

}

export function isExecLayerRequest(request: Request) {
  return isExecLayerPath(new URL(request.url).pathname) && hasExecLayerHeader(request.headers);
}

export function hasExecLayerHeader(headers: Headers) {
  return headers.get(EXEC_LAYER_CALL_HEADER) === '1';
}

export function fromExecLayerPath(pathname: string) {
  if (!isExecLayerPath(pathname)) {
    throw new Error(`${pathname} is not an exec-layer path.`);
  }

  return pathname.slice(EXEC_LAYER_PATH_PREFIX.length);
}

export function toExecLayerPath(pathname: string) {
  if (isExecLayerPath(pathname)) {
    throw new Error(`${pathname} is already an exec-layer path.`);
  }

  return EXEC_LAYER_PATH_PREFIX + (!pathname.startsWith('/') ? '/' : '') + pathname;
}

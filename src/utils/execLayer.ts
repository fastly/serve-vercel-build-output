const EXEC_LAYER_FUNCTION_PATHNAME = 'x-xl-call-pathname';
const EXEC_LAYER_BACKEND = 'self';

/**
 * Performs a fetch using the provided request
 * Note: This modifies and consumes the provided request
 * @param request
 * @param client
 * @param functionPathname
 */
export async function fetchThroughExecLayer(request: Request, client: ClientInfo, functionPathname?: string) {
  request.headers.set(EXEC_LAYER_FUNCTION_PATHNAME, functionPathname ?? new URL(request.url).pathname);

  const clientAddress = client.address ?? '';
  if (clientAddress) {
    request.headers.set('x-forwarded-for', clientAddress);
  }

  return await fetch(request, {
    backend: EXEC_LAYER_BACKEND,
  });
}

/**
 * Get the exec layer function pathname from the request
 * Note: This modifies and removes the value from the request
 * @param request
 */
export function execLayerFunctionPathnameFromRequest(request: Request) {
  const functionPathname = request.headers.get(EXEC_LAYER_FUNCTION_PATHNAME);
  if (functionPathname == null) {
    throw new Error('execLayerRequest is not an Exec Layer Request');
  }
  request.headers.delete(EXEC_LAYER_FUNCTION_PATHNAME);
  return functionPathname;
}

export function isExecLayerRequest(request: Request) {
  return hasExecLayerHeader(request.headers);
}

export function hasExecLayerHeader(headers: Headers) {
  return headers.get(EXEC_LAYER_FUNCTION_PATHNAME) != null;
}

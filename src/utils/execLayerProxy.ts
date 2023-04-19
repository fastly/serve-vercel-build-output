const EXEC_LAYER_FUNCTION_PATHNAME = 'x-xl-call-pathname';
const EXEC_LAYER_BACKEND = 'self';

export async function execLayerProxy(request: Request, client: ClientInfo, functionPathname?: string) {
  const execLayerRequest = createExecLayerRequest(request, client, functionPathname);

  return await fetch(execLayerRequest, {
    backend: EXEC_LAYER_BACKEND,
  });
}

export function createExecLayerRequest(request: Request, client: ClientInfo, functionPathname?: string) {
  const execLayerRequest = request.clone();
  execLayerRequest.headers.set(EXEC_LAYER_FUNCTION_PATHNAME, functionPathname ?? new URL(request.url).pathname);

  const clientAddress = client.address ?? '';
  if (clientAddress) {
    execLayerRequest.headers.set('x-forwarded-for', clientAddress);
  }

  return execLayerRequest;
}

export function fromExecLayerRequest(execLayerRequest: Request) {
  const functionPathname = execLayerRequest.headers.get(EXEC_LAYER_FUNCTION_PATHNAME);
  if (functionPathname == null) {
    throw new Error('execLayerRequest is not an Exec Layer Request');
  }

  const request = execLayerRequest.clone();
  request.headers.delete(EXEC_LAYER_FUNCTION_PATHNAME);

  return { request, functionPathname };
}

export function isExecLayerRequest(request: Request) {
  return hasExecLayerHeader(request.headers);
}

export function hasExecLayerHeader(headers: Headers) {
  return headers.get(EXEC_LAYER_FUNCTION_PATHNAME) != null;
}


/**
 * Generates a (fake) tracing ID for an HTTP request.
 *
 * Example: dev1:q4wlg-1562364135397-7a873ac99c8e
 */
export function generateRequestId(podId: string, isInvoke = false): string {
  const invoke = isInvoke ? 'dev1::' : '';

  // 6 random bytes
  const randomBytes = new Uint8Array(6);
  crypto.getRandomValues(randomBytes);
  const randomBytesAsString = [...randomBytes]
    .map((x: number) => x.toString(16).padStart(2, '0'))
    .join('');

  return `dev1::${invoke}${[
    podId,
    Date.now(),
    randomBytesAsString,
  ].join('-')}`;
}

export type CloneRequestInit = {
  backend?: string,
};

export function cloneRequestWithNewUrl(request: Request, url: string, init?: CloneRequestInit) {

  const newURL = new URL(url, request.url);

  const headers = new Headers(request.headers);

  const requestInit: RequestInit = {
    method: request.method,
    headers,
  };

  if (init?.backend != null) {
    requestInit.backend = init.backend;
  }

  if (request.method !== 'HEAD' && request.method !== 'GET') {
    requestInit.body = request.clone().body;
  }

  return new Request(newURL, requestInit)
}


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

const REGEX_LOCALHOST_HOSTNAME = /(?!^https?:\/\/)(127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}|::1|localhost)/;
export function normalizeUrlLocalhost(url: string) {
  return url.replace(REGEX_LOCALHOST_HOSTNAME, 'localhost');
}

// "Thread Local Storage"
// In Compute@Edge, each request gets its own working space
// so everything here can be considered local to the current "FetchEvent".

let __values: Record<string, any> = {};

export function getThreadLocal<T>(tag: string): T | undefined {
  return __values[tag] as T;
}

export function setThreadLocal<T>(tag: string, value: T) {
  __values[tag] = value;
}

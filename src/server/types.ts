export type BackendDef = {
  url: string,
};

export type BackendsDefs = 'dynamic' | Record<string, string | BackendDef>;
export type Backends = Record<string, BackendDef>;

export type BackendInfo = {
  name: string,
  url: string,
  target: string,
};

export type ServeRequestContext = {
  requestId: string,
  client: ClientInfo,
  waitUntil: (promise: Promise<any>) => void,
};

export type EdgeFunction = (request: Request, context: ServeRequestContext) => Response;

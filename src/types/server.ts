import { RouteWithSrc } from "@vercel/routing-utils";

export type ServeRequestContext = {
  requestId: string,
  waitUntil: (promise: Promise<any>) => void,
};

export type HasFieldEntry = NonNullable<RouteWithSrc['has']>[number];

export type EdgeFunction = (request: Request, context: ServeRequestContext) => Response;

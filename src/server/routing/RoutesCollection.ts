import { HandleValue, isHandler, normalizeRoutes, Route } from "@vercel/routing-utils";

type PhaseName = HandleValue | null;

function getRoutesTypes(routes: Route[]) {
  const handleMap = new Map<PhaseName, Route[]>();
  let prevHandle: HandleValue | null = null;
  routes.forEach(route => {
    if (isHandler(route)) {
      prevHandle = route.handle;
    } else {
      const routes = handleMap.get(prevHandle);
      if (!routes) {
        handleMap.set(prevHandle, [route]);
      } else {
        routes.push(route);
      }
    }
  });

  return handleMap;
}

export default class RoutesCollection {

  readonly routes: Route[];

  readonly handleMap: Map<PhaseName, Route[]>;

  constructor(routes: Route[] | null) {
    // validate the config
    const { routes: normalizedRoutes, error: normalizeError } = normalizeRoutes(routes);

    if(normalizeError != null) {
      throw normalizeError;
    }

    this.routes = normalizedRoutes ?? [];
    this.handleMap = getRoutesTypes(this.routes);
  }

  getPhaseRoutes(phase: PhaseName) {
    return this.handleMap.get(phase) ?? [];
  }

}

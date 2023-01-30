import { HandleValue, isHandler, Route } from "@vercel/routing-utils";

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

export class RoutesCollection {

  handleMap: Map<PhaseName, Route[]>;

  constructor(routes: Route[] | null) {
    this.handleMap = getRoutesTypes(routes ?? []);
  }

  getPhaseRoutes(phase: PhaseName) {
    return this.handleMap.get(phase) ?? [];
  }

}

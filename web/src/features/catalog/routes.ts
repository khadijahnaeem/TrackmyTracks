import type { RouteObject } from "react-router";
import { SearchPage } from "./SearchPage";

export const catalogRoutes: RouteObject[] = [
  { path: "/search", Component: SearchPage },
];

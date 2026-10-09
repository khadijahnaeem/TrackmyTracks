import type { RouteObject } from "react-router";
import { HistoryPage } from "./HistoryPage";

export const historyRoutes: RouteObject[] = [{ path: "/users/:username/history", Component: HistoryPage }];

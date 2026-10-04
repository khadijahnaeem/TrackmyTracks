import { createBrowserRouter, type RouteObject } from "react-router";
import { authRoutes } from "../features/auth/routes";
import { catalogRoutes } from "../features/catalog/routes";
import { historyRoutes } from "../features/history/routes";
import { homeRoutes } from "../features/home/routes";
import { playlistsRoutes } from "../features/playlists/routes";
import { AppShell } from "./AppShell";
import { NotFoundPage } from "./NotFoundPage";

export const routes: RouteObject[] = [
  {
    Component: AppShell,
    children: [
      ...homeRoutes,
      ...authRoutes,
      ...catalogRoutes,
      ...historyRoutes,
      ...playlistsRoutes,
      { path: "*", Component: NotFoundPage },
    ],
  },
];

export const router = createBrowserRouter(routes);

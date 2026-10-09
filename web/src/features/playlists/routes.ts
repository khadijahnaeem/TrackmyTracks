import type { RouteObject } from "react-router";
import { PlaylistPage } from "./PlaylistPage";
import { UserPlaylistsPage } from "./UserPlaylistsPage";

export const playlistsRoutes: RouteObject[] = [
  { path: "/users/:username/playlists", Component: UserPlaylistsPage },
  { path: "/playlists/:id", Component: PlaylistPage },
];

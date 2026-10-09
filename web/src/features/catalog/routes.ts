import type { RouteObject } from "react-router";
import { AlbumPage } from "./AlbumPage";
import { ArtistPage } from "./ArtistPage";
import { SearchPage } from "./SearchPage";
import { SongPage } from "./SongPage";

export const catalogRoutes: RouteObject[] = [
  { path: "/search", Component: SearchPage },
  { path: "/artists/:mbid", Component: ArtistPage },
  { path: "/albums/:mbid", Component: AlbumPage },
  { path: "/songs/:mbid", Component: SongPage },
];

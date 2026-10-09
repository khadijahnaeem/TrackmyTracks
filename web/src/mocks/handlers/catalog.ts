import { http, type HttpHandler } from "msw";
import type { AlbumSummary, ArtistSummary, Kind, SongSummary } from "../../api/types";
import {
  albumSummary,
  albumTracks,
  artistAlbums,
  artistSummary,
  artistTopSongs,
  hasEntity,
  isKind,
  normalizeMbid,
  NOT_IN_CATALOG,
  searchCatalog,
  songSummary,
  SUMMARIES,
} from "../catalog";
import { invalid, notFound, pageArg, paginate, requiredText, route } from "../respond";
import { rated } from "../store";

const SEARCH_PER_PAGE = 25;

// the detail routes answer 404 for any mbid outside the seed
function known(kind: Kind, param: string | readonly string[] | undefined): string {
  const mbid = normalizeMbid(param);
  if (mbid === null || !hasEntity(kind, mbid)) throw notFound(NOT_IN_CATALOG);
  return mbid;
}

export const catalogHandlers: HttpHandler[] = [
  http.get(
    "/api/search",
    route(({ request }) => {
      const url = new URL(request.url);
      const type = url.searchParams.get("type");
      if (!isKind(type)) throw invalid("Type must be song, album, or artist");
      const query = requiredText({ query: url.searchParams.get("q") }, "query", 200);
      const page = pageArg(url);
      const results = paginate(searchCatalog(type, query), page, SEARCH_PER_PAGE);
      return { ...results, items: results.items.map(SUMMARIES[type]) };
    }),
  ),

  http.get(
    "/api/artists/:mbid",
    route(({ params }) => {
      const mbid = known("artist", params.mbid);
      return {
        artist: rated<ArtistSummary>("artist", mbid, artistSummary(mbid)),
        top_songs: artistTopSongs(mbid).map((id) => rated<SongSummary>("song", id, songSummary(id))),
        albums: artistAlbums(mbid).map(albumSummary),
      };
    }),
  ),

  http.get(
    "/api/albums/:mbid",
    route(({ params }) => {
      const mbid = known("album", params.mbid);
      return {
        album: rated<AlbumSummary>("album", mbid, albumSummary(mbid)),
        tracks: albumTracks(mbid).map((id, index) => ({
          ...rated<SongSummary>("song", id, songSummary(id)),
          position: index + 1,
        })),
      };
    }),
  ),

  http.get(
    "/api/songs/:mbid",
    route(({ params }) => {
      const mbid = known("song", params.mbid);
      return { song: rated<SongSummary>("song", mbid, songSummary(mbid)) };
    }),
  ),
];

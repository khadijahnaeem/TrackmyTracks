import { http, type HttpHandler } from "msw";
import type { AlbumSummary, ArtistSummary, Kind, SongSummary } from "../../api/types";
import {
  SUMMARIES,
  albumSummary,
  albumTracks,
  artistAlbums,
  artistSummary,
  artistTopSongs,
  hasEntity,
  searchCatalog,
  songSummary,
} from "../catalog";
import { notFound, invalid, pageArg, pagePayload, requiredText, route } from "../respond";
import { rated } from "../store";

const SEARCH_PER_PAGE = 25;
const KINDS: Kind[] = ["song", "album", "artist"];

const isKind = (value: string | null): value is Kind => KINDS.some((kind) => kind === value);

// the detail routes answer 404 for any mbid outside the seed
function known(kind: Kind, mbid: string | readonly string[] | undefined): string {
  if (typeof mbid !== "string" || !hasEntity(kind, mbid)) throw notFound("Not found in the music catalog");
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
      const matches = searchCatalog(type, query);
      const start = (page - 1) * SEARCH_PER_PAGE;
      const items = matches.slice(start, start + SEARCH_PER_PAGE).map((mbid) => SUMMARIES[type](mbid));
      return pagePayload(items, page, matches.length, SEARCH_PER_PAGE);
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

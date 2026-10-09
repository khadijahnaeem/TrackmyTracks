import { http, type HttpHandler } from "msw";
import type { Playlist, PlaylistDetail } from "../../api/types";
import { hasEntity, songSummary } from "../catalog";
import { conflict, created, invalid, jsonBody, noContent, notFound, optionalText, requiredText, route } from "../respond";
import type { MockPlaylist } from "../store";
import { currentUser, findUserByName, nextId, now, publicUser, requireUser, save, state } from "../store";

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;
const MAX_SONGS = 500;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const playlistPayload = (playlist: MockPlaylist): Playlist => ({
  id: playlist.id,
  name: playlist.name,
  description: playlist.description,
  is_public: playlist.isPublic,
  owner: publicUser(playlist.ownerId),
  song_count: playlist.songs.length,
  updated_at: playlist.updatedAt,
});

const detailPayload = (playlist: MockPlaylist): PlaylistDetail => ({
  ...playlistPayload(playlist),
  songs: playlist.songs.map(songSummary),
});

// a path id that is not an integer never matched the real route, so it is a plain 404
function findPlaylist(id: unknown): MockPlaylist {
  const found = /^\d+$/.test(String(id)) ? state().playlists.find((row) => row.id === Number(id)) : undefined;
  if (!found) throw notFound("Playlist not found");
  return found;
}

function visiblePlaylist(id: unknown): MockPlaylist {
  const playlist = findPlaylist(id);
  if (!playlist.isPublic && playlist.ownerId !== currentUser()?.id) throw notFound("Playlist not found");
  return playlist;
}

function ownedPlaylist(id: unknown): MockPlaylist {
  const playlist = findPlaylist(id);
  if (playlist.ownerId !== currentUser()?.id) throw notFound("Playlist not found");
  return playlist;
}

type PlaylistFields = Partial<Pick<MockPlaylist, "name" | "description" | "isPublic">>;

function parseFields(data: Record<string, unknown>, partial: boolean): PlaylistFields {
  const fields: PlaylistFields = {};
  if (!partial || "name" in data) fields.name = requiredText(data, "name", NAME_MAX_LENGTH);
  if ("description" in data) fields.description = optionalText(data, "description", DESCRIPTION_MAX_LENGTH);
  if ("is_public" in data) {
    if (typeof data.is_public !== "boolean") throw invalid("Visibility must be true or false");
    fields.isPublic = data.is_public;
  }
  return fields;
}

function parseMbids(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((mbid) => typeof mbid === "string")) {
    throw invalid("Mbids must be a list of MusicBrainz IDs");
  }
  return value;
}

export const playlistsHandlers: HttpHandler[] = [
  http.get(
    "/api/users/:username/playlists",
    route(({ params }) => {
      const owner = findUserByName(String(params.username));
      if (!owner) throw notFound("User not found");
      const viewing = currentUser()?.id === owner.id;
      const items = state()
        .playlists.filter((row) => row.ownerId === owner.id && (row.isPublic || viewing))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
      return { items: items.map(playlistPayload) };
    }),
  ),

  http.post(
    "/api/playlists",
    route(async ({ request }) => {
      const user = requireUser();
      const fields = parseFields(await jsonBody(request), false);
      const playlist = {
        id: nextId(),
        ownerId: user.id,
        name: "",
        description: null,
        isPublic: true,
        songs: [],
        updatedAt: now(),
        ...fields,
      };
      state().playlists.push(playlist);
      save();
      return created(playlistPayload(playlist));
    }),
  ),

  http.get(
    "/api/playlists/:id",
    route(({ params }) => detailPayload(visiblePlaylist(params.id))),
  ),

  http.patch(
    "/api/playlists/:id",
    route(async ({ params, request }) => {
      requireUser();
      const playlist = ownedPlaylist(params.id);
      Object.assign(playlist, parseFields(await jsonBody(request), true), { updatedAt: now() });
      save();
      return playlistPayload(playlist);
    }),
  ),

  http.delete(
    "/api/playlists/:id",
    route(({ params }) => {
      requireUser();
      const playlist = ownedPlaylist(params.id);
      state().playlists = state().playlists.filter((row) => row !== playlist);
      save();
      return noContent();
    }),
  ),

  http.post(
    "/api/playlists/:id/songs",
    route(async ({ params, request }) => {
      requireUser();
      const { mbid } = await jsonBody(request);
      if (typeof mbid !== "string" || !UUID_PATTERN.test(mbid)) throw invalid("A valid MusicBrainz ID is required");
      const playlist = ownedPlaylist(params.id);
      const song = mbid.toLowerCase();
      if (!hasEntity("song", song)) throw notFound("Song not found");
      if (playlist.songs.includes(song)) throw conflict("Song is already in this playlist");
      if (playlist.songs.length >= MAX_SONGS) throw invalid(`Playlists hold up to ${MAX_SONGS} songs`);
      playlist.songs.push(song);
      playlist.updatedAt = now();
      save();
      return created(detailPayload(playlist));
    }),
  ),

  http.delete(
    "/api/playlists/:id/songs/:mbid",
    route(({ params }) => {
      requireUser();
      const playlist = ownedPlaylist(params.id);
      const index = playlist.songs.indexOf(String(params.mbid).toLowerCase());
      if (index < 0) throw notFound("Song is not in this playlist");
      playlist.songs.splice(index, 1);
      playlist.updatedAt = now();
      save();
      return detailPayload(playlist);
    }),
  ),

  http.put(
    "/api/playlists/:id/songs",
    route(async ({ params, request }) => {
      requireUser();
      const mbids = parseMbids((await jsonBody(request)).mbids).map((mbid) => mbid.toLowerCase());
      const playlist = ownedPlaylist(params.id);
      if (mbids.length !== playlist.songs.length || !playlist.songs.every((mbid) => mbids.includes(mbid))) {
        throw invalid("Reorder must list every song in the playlist exactly once");
      }
      playlist.songs = mbids;
      playlist.updatedAt = now();
      save();
      return detailPayload(playlist);
    }),
  ),
];

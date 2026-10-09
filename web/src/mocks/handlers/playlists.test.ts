import { afterEach, expect, test, vi } from "vitest";
import type { Playlist, PlaylistDetail } from "../../api/types";
import { AIRBAG, DEMO_LOGIN, KARMA_POLICE, LET_DOWN, LUCKY, PARANOID_ANDROID, SEED_PLAYLISTS } from "../seed";
import type { MockPlaylist } from "../seed";
import { save, state } from "../store";
import { call, useMockServer } from "../testing";
import { authHandlers } from "./auth";
import { playlistsHandlers } from "./playlists";

useMockServer(...authHandlers, ...playlistsHandlers);

const MIRA_LOGIN = { email: "mira@trackmytracks.dev", password: "mira-listens-1" };
// seeded by mira, so demo may not edit it
const [{ id: MIRAS_PLAYLIST }] = SEED_PLAYLISTS as [MockPlaylist];
// seeded private for demo, so it shows only to its owner
const DEMO_PRIVATE = SEED_PLAYLISTS.find((playlist) => !playlist.isPublic)!.id;
const NOT_FOUND = { status: 404, body: { error: { code: "not_found", message: "Playlist not found" } } };

afterEach(() => vi.useRealTimers());

// timestamps are millisecond precise, so edits need a clock that moves between them
function tickingClock(): () => void {
  vi.useFakeTimers({ toFake: ["Date"] });
  return () => vi.advanceTimersByTime(1000);
}

const logIn = (login = DEMO_LOGIN) => call("POST", "/auth/login", login);
const create = (body: unknown) => call<Playlist>("POST", "/playlists", body);
const addSong = (id: number, mbid: unknown) => call<PlaylistDetail>("POST", `/playlists/${id}/songs`, { mbid });
const reorder = (id: number, mbids: unknown) => call<PlaylistDetail>("PUT", `/playlists/${id}/songs`, { mbids });
const mbidsOf = (playlist: PlaylistDetail) => playlist.songs.map((song) => song.mbid);

async function seeded(...mbids: string[]): Promise<number> {
  await logIn();
  const { body } = await create({ name: "Night drive" });
  for (const mbid of mbids) await addSong(body.id, mbid);
  return body.id;
}

test("create, add, and reorder songs", async () => {
  await logIn();
  const made = await create({ name: "  Night drive  ", description: "  " });
  expect(made.status).toBe(201);
  expect(made.body).toMatchObject({
    name: "Night drive",
    description: null,
    is_public: true,
    owner: { username: "demo" },
    song_count: 0,
  });

  await addSong(made.body.id, AIRBAG);
  const added = await addSong(made.body.id, LUCKY);
  expect(added.status).toBe(201);
  expect(mbidsOf(added.body)).toEqual([AIRBAG, LUCKY]);
  expect(added.body.song_count).toBe(2);

  const reordered = await reorder(made.body.id, [LUCKY, AIRBAG]);
  expect(reordered.status).toBe(200);
  expect(mbidsOf(reordered.body)).toEqual([LUCKY, AIRBAG]);
  expect(mbidsOf((await call<PlaylistDetail>("GET", `/playlists/${made.body.id}`)).body)).toEqual([LUCKY, AIRBAG]);
});

test("create validates the fields", async () => {
  await logIn();
  const missing = await create({ description: "no name" });
  expect(missing).toEqual({
    status: 422,
    body: { error: { code: "validation_error", message: "Name is required" } },
  });
  const visibility = await create({ name: "Night drive", is_public: "yes" });
  expect(visibility.body).toEqual({ error: { code: "validation_error", message: "Visibility must be true or false" } });
});

test("patch changes only the keys sent and bumps updated_at", async () => {
  const tick = tickingClock();
  const id = await seeded();
  const before = (await call<PlaylistDetail>("GET", `/playlists/${id}`)).body;
  tick();
  const patched = await call<Playlist>("PATCH", `/playlists/${id}`, { is_public: false });
  expect(patched.status).toBe(200);
  expect(patched.body).toMatchObject({ name: "Night drive", is_public: false });
  expect(patched.body.updated_at > before.updated_at).toBe(true);

  const renamed = await call<Playlist>("PATCH", `/playlists/${id}`, { name: "Day drive", description: "Windows down" });
  expect(renamed.body).toMatchObject({ name: "Day drive", description: "Windows down", is_public: false });
  const blank = await call("PATCH", `/playlists/${id}`, { name: " " });
  expect(blank.status).toBe(422);
});

test("private playlists hide from others", async () => {
  const id = await seeded();
  await call("PATCH", `/playlists/${id}`, { is_public: false });
  expect((await call("GET", `/playlists/${id}`)).status).toBe(200);

  await logIn(MIRA_LOGIN);
  expect(await call("GET", `/playlists/${id}`)).toEqual(NOT_FOUND);
  await call("POST", "/auth/logout");
  expect(await call("GET", `/playlists/${id}`)).toEqual(NOT_FOUND);
});

test("a duplicate song conflicts", async () => {
  const id = await seeded(AIRBAG);
  expect(await addSong(id, AIRBAG)).toEqual({
    status: 409,
    body: { error: { code: "conflict", message: "Song is already in this playlist" } },
  });
});

test("adding validates the mbid and the catalog", async () => {
  const id = await seeded();
  const bad = await addSong(id, "nope");
  expect(bad.status).toBe(422);
  expect(bad.body).toEqual({ error: { code: "validation_error", message: "A valid MusicBrainz ID is required" } });
  const unknown = await addSong(id, "00000000-0000-4000-8000-000000000000");
  expect(unknown).toEqual({
    status: 404,
    body: { error: { code: "not_found", message: "Not found in the music catalog" } },
  });
});

test("a playlist holds up to 500 songs", async () => {
  await logIn();
  const { body } = await create({ name: "Full" });
  const mbids = Array.from({ length: 500 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
  state().playlists.find((row) => row.id === body.id)!.songs = mbids;
  save();
  expect(await addSong(body.id, AIRBAG)).toEqual({
    status: 422,
    body: { error: { code: "validation_error", message: "Playlists hold up to 500 songs" } },
  });
});

test("removing a song keeps the rest in order", async () => {
  const id = await seeded(AIRBAG, LUCKY, LET_DOWN);
  const removed = await call<PlaylistDetail>("DELETE", `/playlists/${id}/songs/${LUCKY}`);
  expect(removed.status).toBe(200);
  expect(mbidsOf(removed.body)).toEqual([AIRBAG, LET_DOWN]);
  const again = await call("DELETE", `/playlists/${id}/songs/${LUCKY}`);
  expect(again).toEqual({
    status: 404,
    body: { error: { code: "not_found", message: "Song is not in this playlist" } },
  });
});

test("reorder must list every song once", async () => {
  const id = await seeded(AIRBAG, LUCKY);
  const message = "Reorder must list every song in the playlist exactly once";
  for (const mbids of [[AIRBAG], [AIRBAG, AIRBAG], [AIRBAG, PARANOID_ANDROID]]) {
    expect(await reorder(id, mbids)).toEqual({
      status: 422,
      body: { error: { code: "validation_error", message } },
    });
  }
  const notList = await reorder(id, "AIRBAG");
  expect(notList.body).toEqual({
    error: { code: "validation_error", message: "Mbids must be a list of MusicBrainz IDs" },
  });
});

test("every change bumps updated_at", async () => {
  const tick = tickingClock();
  const id = await seeded(AIRBAG);
  const stamp = async () => (await call<PlaylistDetail>("GET", `/playlists/${id}`)).body.updated_at;
  const first = await stamp();
  tick();
  await addSong(id, LUCKY);
  const second = await stamp();
  tick();
  await reorder(id, [LUCKY, AIRBAG]);
  const third = await stamp();
  tick();
  await call("DELETE", `/playlists/${id}/songs/${AIRBAG}`);
  const fourth = await stamp();
  expect(first < second && second < third && third < fourth).toBe(true);
});

test("an owner sees private playlists", async () => {
  const id = await seeded();
  await call("PATCH", `/playlists/${id}`, { is_public: false });
  const mine = await call<{ items: Playlist[] }>("GET", "/users/demo/playlists");
  expect(mine.body.items.map((playlist) => playlist.id)).toEqual([id, DEMO_PRIVATE]);

  await logIn(MIRA_LOGIN);
  const others = await call<{ items: Playlist[] }>("GET", "/users/demo/playlists");
  expect(others.body.items).toEqual([]);
  const hers = await call<{ items: Playlist[] }>("GET", "/users/mira/playlists");
  expect(hers.body.items.map((playlist) => playlist.name)).toEqual(["Rainy tram rides"]);
});

test("a user's playlists list newest first", async () => {
  const tick = tickingClock();
  await logIn();
  const older = await create({ name: "Older" });
  tick();
  const newer = await create({ name: "Newer" });
  tick();
  await call("PATCH", `/playlists/${older.body.id}`, { description: "touched" });
  const { body } = await call<{ items: Playlist[] }>("GET", "/users/demo/playlists");
  expect(body.items.map((playlist) => playlist.id)).toEqual([older.body.id, newer.body.id, DEMO_PRIVATE]);
});

test("an unknown user answers 404", async () => {
  expect(await call("GET", "/users/nobody/playlists")).toEqual({
    status: 404,
    body: { error: { code: "not_found", message: "User not found" } },
  });
});

test("edits are owner only", async () => {
  const unauthorized = { status: 401, body: { error: { code: "unauthorized", message: "Log in to continue" } } };
  const base = `/playlists/${MIRAS_PLAYLIST}`;
  expect(await create({ name: "Night drive" })).toEqual(unauthorized);
  expect(await call("PATCH", base, { name: "Mine now" })).toEqual(unauthorized);
  expect(await call("DELETE", base)).toEqual(unauthorized);
  expect(await addSong(MIRAS_PLAYLIST, AIRBAG)).toEqual(unauthorized);

  await logIn();
  expect(await call("PATCH", base, { name: "Mine now" })).toEqual(NOT_FOUND);
  expect(await call("DELETE", base)).toEqual(NOT_FOUND);
  expect(await addSong(MIRAS_PLAYLIST, KARMA_POLICE)).toEqual(NOT_FOUND);
  expect(await call("DELETE", `${base}/songs/${AIRBAG}`)).toEqual(NOT_FOUND);
  expect(await reorder(MIRAS_PLAYLIST, [])).toEqual(NOT_FOUND);
});

test("a non integer id answers 404", async () => {
  expect(await call("GET", "/playlists/abc")).toEqual(NOT_FOUND);
});

test("delete answers 204 and then 404", async () => {
  const id = await seeded(AIRBAG);
  const removed = await call("DELETE", `/playlists/${id}`);
  expect(removed).toEqual({ status: 204, body: undefined });
  expect(await call("GET", `/playlists/${id}`)).toEqual(NOT_FOUND);
});

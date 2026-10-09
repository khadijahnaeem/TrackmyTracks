import { expect, test } from "vitest";
import type { AlbumSummary, Page, SongSummary, Rated } from "../../api/types";
import { AIRBAG, DEMO_LOGIN, IN_RAINBOWS, OK_COMPUTER, RADIOHEAD } from "../seed";
import { call, useMockServer } from "../testing";
import { authHandlers } from "./auth";
import { catalogHandlers } from "./catalog";

useMockServer(...authHandlers, ...catalogHandlers);

type Track = Rated<SongSummary> & { position: number };

test("search pages artist results", async () => {
  const found = await call("GET", "/search?type=artist&q=radio");
  expect(found).toEqual({
    status: 200,
    body: { items: [{ mbid: RADIOHEAD, name: "Radiohead" }], page: 1, pages: 1, total: 1 },
  });
});

test("search requires a query", async () => {
  const blank = await call("GET", "/search?type=song&q=%20%20");
  expect(blank).toEqual({
    status: 422,
    body: { error: { code: "validation_error", message: "Query is required" } },
  });
});

test("search rejects an unknown type", async () => {
  const bad = await call("GET", "/search?type=label&q=radio");
  expect(bad.body).toMatchObject({ error: { message: "Type must be song, album, or artist" } });
});

test("album detail lists rated tracks in order", async () => {
  const detail = await call<{ tracks: Track[] }>("GET", `/albums/${OK_COMPUTER}`);
  expect(detail.status).toBe(200);
  expect(detail.body.tracks[0]).toMatchObject({ position: 1, title: "Airbag", rating: { mine: null } });
  expect(detail.body.tracks[0].rating.community.count).toBeGreaterThan(0);
});

test("artist detail shows top songs and albums", async () => {
  const detail = await call<{ top_songs: SongSummary[]; albums: AlbumSummary[] }>("GET", `/artists/${RADIOHEAD}`);
  expect(detail.body.top_songs).toHaveLength(5);
  expect(detail.body.albums.map((album) => album.title)).toEqual(["In Rainbows", "OK Computer"]);
  expect(detail.body.albums.map((album) => album.mbid)).toEqual([IN_RAINBOWS, OK_COMPUTER]);
});

test("detail ratings follow the session", async () => {
  const out = await call<{ song: Rated<SongSummary> }>("GET", `/songs/${AIRBAG}`);
  expect(out.body.song.rating.mine).toBeNull();
  await call("POST", "/auth/login", DEMO_LOGIN);
  const signedIn = await call<{ song: Rated<SongSummary> }>("GET", `/songs/${AIRBAG}`);
  expect(signedIn.body.song.rating.mine).not.toBeNull();
});

test("an unknown mbid is not found", async () => {
  const missing = await call<Page<never>>("GET", "/albums/00000000-0000-0000-0000-000000000000");
  expect(missing).toEqual({
    status: 404,
    body: { error: { code: "not_found", message: "Not found in the music catalog" } },
  });
});

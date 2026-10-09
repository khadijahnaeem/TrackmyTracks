import { expect, test } from "vitest";
import type { Page, RatingSummary, Review } from "../../api/types";
import { AIRBAG, DEMO_LOGIN, OK_COMPUTER, PARANOID_ANDROID } from "../seed";
import { call, useMockServer } from "../testing";
import { authHandlers } from "./auth";
import { ratingsHandlers } from "./ratings";

useMockServer(...authHandlers, ...ratingsHandlers);

type Saved = { mbid: string; rating: RatingSummary };

const logIn = () => call("POST", "/auth/login", DEMO_LOGIN);
const rate = (body: unknown) => call<Saved>("PUT", "/ratings", body);
const song = { kind: "song", mbid: PARANOID_ANDROID };

test("rating a song returns the fresh summary", async () => {
  await logIn();
  const saved = await rate({ ...song, stars: 4 });
  expect(saved.status).toBe(200);
  expect(saved.body.mbid).toBe(PARANOID_ANDROID);
  expect(saved.body.rating.mine).toMatchObject({ stars: 4, is_derived: false });
  expect(saved.body.rating.community.count).toBeGreaterThan(0);
});

test("a whitespace review is stored as null", async () => {
  await logIn();
  const saved = await rate({ ...song, stars: 4, review: "   " });
  expect(saved.body.rating.mine?.review).toBeNull();
});

test("omitting review keeps the saved one", async () => {
  await logIn();
  await rate({ ...song, stars: 4, review: "Still lands" });
  const again = await rate({ ...song, stars: 5 });
  expect(again.body.rating.mine).toMatchObject({ stars: 5, review: "Still lands" });
  const cleared = await rate({ ...song, stars: 5, review: "" });
  expect(cleared.body.rating.mine?.review).toBeNull();
});

test("clearing an album override returns the average", async () => {
  await logIn();
  await rate({ kind: "song", mbid: AIRBAG, stars: 4 });
  await rate({ ...song, stars: 5 });
  const overridden = await rate({ kind: "album", mbid: OK_COMPUTER, stars: 1 });
  expect(overridden.body.rating.mine).toMatchObject({ stars: 1, is_derived: false });
  const cleared = await call<Saved>("DELETE", `/ratings/album/${OK_COMPUTER}`);
  expect(cleared.status).toBe(200);
  expect(cleared.body.rating.mine).toMatchObject({ is_derived: true });
});

test("clearing a missing rating still answers the summary", async () => {
  await logIn();
  const cleared = await call<Saved>("DELETE", `/ratings/song/${PARANOID_ANDROID}`);
  expect(cleared.status).toBe(200);
  expect(cleared.body.rating.mine).toBeNull();
});

test("rating requires login", async () => {
  const expected = { status: 401, body: { error: { code: "unauthorized", message: "Log in to continue" } } };
  expect(await rate({ ...song, stars: 4 })).toEqual(expected);
  expect(await call("DELETE", `/ratings/song/${PARANOID_ANDROID}`)).toEqual(expected);
});

test("half steps only", async () => {
  await logIn();
  for (const stars of [3.3, 0, 5.5, "4", true, null]) {
    const bad = await rate({ ...song, stars });
    expect(bad).toEqual({
      status: 422,
      body: { error: { code: "validation_error", message: "Stars must be 0.5 to 5 in half star steps" } },
    });
  }
});

test("kind, mbid, and body are validated", async () => {
  await logIn();
  expect((await rate({ kind: "label", mbid: PARANOID_ANDROID, stars: 4 })).body).toMatchObject({
    error: { message: "Kind must be song, album, or artist" },
  });
  expect((await rate({ kind: "song", mbid: "nope", stars: 4 })).body).toMatchObject({
    error: { message: "Mbid must be a MusicBrainz ID" },
  });
  expect((await rate({ ...song, stars: 4, review: "x".repeat(2001) })).status).toBe(422);
  expect((await call("PUT", "/ratings", ["song"])).body).toMatchObject({
    error: { message: "Request body must be a JSON object" },
  });
});

test("a failed rating leaves the store alone", async () => {
  await logIn();
  await rate({ ...song, stars: 4, review: "x".repeat(2001) });
  expect((await call<Saved>("DELETE", `/ratings/song/${PARANOID_ANDROID}`)).body.rating.mine).toBeNull();
});

const UNKNOWN_MBID = "00000000-0000-0000-0000-000000000000";

test("rating an mbid outside the seed is not in the catalog", async () => {
  await logIn();
  expect(await rate({ kind: "album", mbid: UNKNOWN_MBID, stars: 4 })).toEqual({
    status: 404,
    body: { error: { code: "not_found", message: "Not found in the music catalog" } },
  });
});

test("clearing an mbid outside the seed names the kind", async () => {
  await logIn();
  expect(await call("DELETE", `/ratings/album/${UNKNOWN_MBID}`)).toEqual({
    status: 404,
    body: { error: { code: "not_found", message: "Album not found" } },
  });
});

test("reviews list newest first with no empty reviews", async () => {
  const before = await call<Page<Review>>("GET", `/albums/${OK_COMPUTER}/reviews`);
  expect(before.body).toMatchObject({ page: 1, pages: 1, total: 1 });
  expect(before.body.items[0]).toMatchObject({ user: { username: "mira" }, stars: 5 });

  await logIn();
  await rate({ kind: "album", mbid: OK_COMPUTER, stars: 3.5, review: "Cold and precise" });
  const after = await call<Page<Review>>("GET", `/albums/${OK_COMPUTER}/reviews`);
  expect(after.body.items.map((item) => item.user.username)).toEqual(["demo", "mira"]);
  expect(after.body.items[0]).toMatchObject({ stars: 3.5, review: "Cold and precise" });
});

test("an unknown target gives an empty page", async () => {
  const empty = await call("GET", "/songs/00000000-0000-0000-0000-000000000000/reviews?page=2");
  expect(empty).toEqual({ status: 200, body: { items: [], page: 2, pages: 0, total: 0 } });
});

test("reviews only serve the three collections", async () => {
  const bad = await call("GET", `/labels/${OK_COMPUTER}/reviews`).catch(() => "unhandled");
  expect(bad).toBe("unhandled");
});

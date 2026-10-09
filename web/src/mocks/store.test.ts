import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Kind } from "../api/types";
import {
  AIRBAG,
  BISCUIT,
  EXIT_MUSIC,
  KARMA_POLICE,
  NO_SURPRISES,
  OK_COMPUTER,
  PARANOID_ANDROID,
  RADIOHEAD,
  RECKONER,
  SEED_USERS,
} from "./seed";
import {
  STORAGE_KEY,
  currentUser,
  forgetState,
  logIn,
  ratingSummary,
  requireUser,
  resetStore,
  save,
  state,
} from "./store";

const [MIRA, JONAH] = SEED_USERS;
const OK_COMPUTER_SONGS = [AIRBAG, PARANOID_ANDROID, EXIT_MUSIC];

let ratingId = 1000;
const rate = (userId: number, kind: Kind, mbid: string, score: number, review: string | null = null) =>
  state().ratings.push({ id: ratingId++, userId, kind, mbid, score, review, updatedAt: "2026-10-01T00:00:00.000Z" });

const rateOkComputerSongs = (userId: number) =>
  OK_COMPUTER_SONGS.forEach((mbid, index) => rate(userId, "song", mbid, [7, 8, 7][index]));

beforeEach(() => {
  localStorage.clear();
  resetStore();
  state().ratings = [];
  logIn(MIRA);
});

describe("rating summaries", () => {
  test("an explicit song rating shows as mine", () => {
    rate(MIRA.id, "song", AIRBAG, 7, "Opens strong");
    expect(ratingSummary("song", AIRBAG).mine).toEqual({
      stars: 3.5,
      is_derived: false,
      song_count: 0,
      review: "Opens strong",
    });
  });

  test("album stars average my song ratings when not rated", () => {
    rateOkComputerSongs(MIRA.id);
    expect(ratingSummary("album", OK_COMPUTER).mine).toEqual({
      stars: 3.7,
      is_derived: true,
      song_count: 3,
      review: null,
    });
  });

  test("an explicit album rating overrides the average", () => {
    rateOkComputerSongs(MIRA.id);
    rate(MIRA.id, "album", OK_COMPUTER, 9);
    expect(ratingSummary("album", OK_COMPUTER).mine).toMatchObject({ stars: 4.5, is_derived: false, song_count: 3 });
  });

  test("an artist averages my songs by that artist", () => {
    rate(MIRA.id, "song", AIRBAG, 6);
    rate(MIRA.id, "song", RECKONER, 9);
    expect(ratingSummary("artist", RADIOHEAD).mine).toMatchObject({ stars: 3.8, is_derived: true, song_count: 2 });
  });

  test("community averages effective stars across users", () => {
    rateOkComputerSongs(MIRA.id);
    rate(JONAH.id, "album", OK_COMPUTER, 9);
    expect(ratingSummary("album", OK_COMPUTER).community).toEqual({ stars: 4.1, count: 2 });
  });

  test("no ratings give an empty community", () => {
    expect(ratingSummary("song", BISCUIT)).toEqual({ mine: null, community: { stars: null, count: 0 } });
  });

  test("a logged out visitor sees the community but no mine", () => {
    rate(JONAH.id, "song", KARMA_POLICE, 9);
    state().sessionUserId = null;
    expect(ratingSummary("song", KARMA_POLICE)).toEqual({ mine: null, community: { stars: 4.5, count: 1 } });
  });
});

describe("persistence", () => {
  test("state survives a reload", async () => {
    rate(MIRA.id, "song", NO_SURPRISES, 5);
    save();
    vi.resetModules();
    const fresh = await import("./store");
    expect(fresh.state().ratings).toHaveLength(1);
  });

  test("saved state from another version is discarded", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state(), version: 0 }));
    vi.resetModules();
    const fresh = await import("./store");
    expect(fresh.state().ratings.length).toBeGreaterThan(0);
  });

  test("unparsable saved state loads the seed", async () => {
    localStorage.setItem(STORAGE_KEY, "{nope");
    vi.resetModules();
    const fresh = await import("./store");
    expect(fresh.state().users).toHaveLength(SEED_USERS.length);
  });

  test("forgetting state reloads what another tab saved", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state(), sessionUserId: JONAH.id }));
    forgetState();
    expect(currentUser()?.id).toBe(JONAH.id);
  });

  test("new ids start above every seed id", () => {
    expect(state().nextId).toBe(31);
  });
});

describe("session", () => {
  test("a session for a missing user reads as logged out", () => {
    state().sessionUserId = 999;
    expect(currentUser()).toBeNull();
  });

  test("requireUser without a session is unauthorized", () => {
    state().sessionUserId = null;
    expect(() => requireUser()).toThrow(expect.objectContaining({ status: 401, message: "Log in to continue" }));
  });
});

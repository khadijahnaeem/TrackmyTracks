import type { Kind, MyRating, PublicUser, Rated, RatingSummary, User } from "../api/types";
import { songsBy, songsOn } from "./catalog";
import { unauthorized } from "./respond";
import { SEED_PLAYLISTS, SEED_RATINGS, SEED_USERS } from "./seed";
import type { MockPlaylist, MockRating, MockUser } from "./seed";

export type { MockPlaylist, MockRating, MockUser };

export const STORAGE_KEY = "trackmytracks-mock";
export const STORE_VERSION = 1;

export interface MockState {
  version: number;
  sessionUserId: number | null;
  users: MockUser[];
  ratings: MockRating[];
  playlists: MockPlaylist[];
  nextId: number;
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

// tenths of a star, exact for half steps where float division of stars is not
const derivedStars = (scores: number[]) => Math.round((sum(scores) * 5) / scores.length) / 10;
const communityStars = (stars: number[]) => Math.round(sum(stars.map((s) => s * 10)) / stars.length) / 10;

function seedState(): MockState {
  const seed = { users: SEED_USERS, ratings: SEED_RATINGS, playlists: SEED_PLAYLISTS };
  const ids = Object.values(seed).flatMap((rows) => rows.map((row) => row.id));
  return { version: STORE_VERSION, sessionUserId: null, ...structuredClone(seed), nextId: Math.max(...ids) + 1 };
}

function loadState(): MockState {
  try {
    const saved: MockState | null = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved?.version === STORE_VERSION) return saved;
  } catch {
    // unparsable json falls back to the seed below
  }
  return seedState();
}

let current: MockState | null = null;

export const state = (): MockState => (current ??= loadState());

// another tab saved, so the next state() reads its copy
export const forgetState = (): void => {
  current = null;
};

export const save = (): void => localStorage.setItem(STORAGE_KEY, JSON.stringify(state()));

export function resetStore(): void {
  current = seedState();
  save();
}

export const nextId = (): number => state().nextId++;

// the same order everywhere a list shows recent activity first
export const newestFirst = (a: { updatedAt: string; id: number }, b: { updatedAt: string; id: number }): number =>
  b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id;

export const now = (): string => new Date().toISOString();

export const findUserByName = (username: string): MockUser | null =>
  state().users.find((user) => user.username === username) ?? null;

export function currentUser(): MockUser | null {
  const { sessionUserId, users } = state();
  return users.find((user) => user.id === sessionUserId) ?? null;
}

export function requireUser(): MockUser {
  const user = currentUser();
  if (!user) throw unauthorized();
  return user;
}

export function logIn(user: MockUser): void {
  state().sessionUserId = user.id;
  save();
}

export function logOut(): void {
  state().sessionUserId = null;
  save();
}

export const userPayload = (user: MockUser): User => ({ id: user.id, username: user.username, email: user.email });

export function publicUser(userId: number): PublicUser {
  const user = state().users.find((row) => row.id === userId);
  if (!user) throw new Error(`unknown user ${userId}`);
  return { username: user.username };
}

// one user's rating of a target, an explicit album or artist rating overrides the song average
function effectiveRating(userId: number, kind: Kind, mbid: string): MyRating | null {
  const mine = state().ratings.filter((rating) => rating.userId === userId);
  const explicit = mine.find((rating) => rating.kind === kind && rating.mbid === mbid);
  if (kind === "song") {
    return explicit ? { stars: explicit.score / 2, is_derived: false, song_count: 0, review: explicit.review } : null;
  }

  const members = new Set(kind === "album" ? songsOn(mbid) : songsBy(mbid));
  const scores = mine.filter((rating) => rating.kind === "song" && members.has(rating.mbid)).map((r) => r.score);
  if (explicit) {
    return { stars: explicit.score / 2, is_derived: false, song_count: scores.length, review: explicit.review };
  }
  return scores.length ? { stars: derivedStars(scores), is_derived: true, song_count: scores.length, review: null } : null;
}

export function ratingSummary(kind: Kind, mbid: string): RatingSummary {
  const everyone = state().users.flatMap((user) => effectiveRating(user.id, kind, mbid) ?? []);
  const user = currentUser();
  return {
    mine: user ? effectiveRating(user.id, kind, mbid) : null,
    community: {
      stars: everyone.length ? communityStars(everyone.map((rating) => rating.stars)) : null,
      count: everyone.length,
    },
  };
}

export const rated = <T>(kind: Kind, mbid: string, summary: T): Rated<T> => ({
  ...summary,
  rating: ratingSummary(kind, mbid),
});

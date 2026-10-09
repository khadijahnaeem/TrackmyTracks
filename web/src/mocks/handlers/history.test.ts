import { afterEach, expect, test, vi } from "vitest";
import type { HistoryEntry, Page } from "../../api/types";
import { AIRBAG, DEMO_LOGIN, OK_COMPUTER, PARANOID_ANDROID } from "../seed";
import { call, useMockServer } from "../testing";
import { authHandlers } from "./auth";
import { historyHandlers } from "./history";
import { ratingsHandlers } from "./ratings";

useMockServer(...authHandlers, ...ratingsHandlers, ...historyHandlers);

afterEach(() => vi.useRealTimers());

const logIn = () => call("POST", "/auth/login", DEMO_LOGIN);
const history = (query = "") => call<Page<HistoryEntry>>("GET", `/users/demo/history${query}`);

// timestamps are millisecond precise, so ratings need a clock that moves between them
async function rate(kind: string, mbid: string, stars: number, review?: string): Promise<void> {
  await call("PUT", "/ratings", { kind, mbid, stars, review });
  vi.advanceTimersByTime(1000);
}

test("history lists explicit ratings newest first", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  await logIn();
  await rate("song", PARANOID_ANDROID, 4.5, "Slow burn");
  await rate("album", OK_COMPUTER, 5);

  const { status, body } = await history();
  expect(status).toBe(200);
  expect(body.items.slice(0, 2).map((entry) => entry.kind)).toEqual(["album", "song"]);
  expect(body.items[0]).toMatchObject({ stars: 5, review: null, item: { mbid: OK_COMPUTER } });
  expect(body.items[1]).toMatchObject({ stars: 4.5, review: "Slow burn", item: { mbid: PARANOID_ANDROID } });
});

test("kind filters the entries", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  await logIn();
  await rate("song", PARANOID_ANDROID, 4);
  await rate("album", OK_COMPUTER, 5);

  const { body } = await history("?kind=album");
  expect(body.items.map((entry) => entry.kind)).toEqual(["album"]);
  expect(body.total).toBe(1);
});

test("derived album ratings stay out", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  await logIn();
  await rate("song", AIRBAG, 4);
  await rate("song", PARANOID_ANDROID, 5);

  const { body } = await history("?kind=album");
  expect(body).toEqual({ items: [], page: 1, pages: 0, total: 0 });
});

test("an unknown kind is rejected", async () => {
  expect(await history("?kind=playlist")).toEqual({
    status: 422,
    body: { error: { code: "validation_error", message: "Kind must be song, album, or artist" } },
  });
});

test("an unknown user is not found", async () => {
  expect(await call("GET", "/users/ghost/history")).toEqual({
    status: 404,
    body: { error: { code: "not_found", message: "User not found" } },
  });
});

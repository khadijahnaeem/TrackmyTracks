import { http } from "msw";
import { expect, test } from "vitest";
import {
  invalid,
  isUnhandledApiRequest,
  optionalText,
  paginate,
  pageArg,
  requiredText,
  route,
} from "./respond";
import { call, useMockServer } from "./testing";

useMockServer(
  http.get("/api/ok", route(() => ({ ok: true }))),
  http.get(
    "/api/bad",
    route(() => {
      throw invalid("Name is required");
    }),
  ),
);

test("a returned value answers 200 json", async () => {
  expect(await call("GET", "/ok")).toEqual({ status: 200, body: { ok: true } });
});

test("a thrown MockApiError answers the error shape", async () => {
  expect(await call("GET", "/bad")).toEqual({
    status: 422,
    body: { error: { code: "validation_error", message: "Name is required" } },
  });
});

test("optionalText trims and stores empty as null", () => {
  expect(optionalText({ review: "   " }, "review", 2000)).toBeNull();
});

test("text over the limit is rejected", () => {
  expect(() => optionalText({ review: "a".repeat(2001) }, "review", 2000)).toThrow(
    "Review must be 2000 characters or fewer",
  );
});

test("requiredText names the missing field", () => {
  expect(() => requiredText({}, "name", 100)).toThrow("Name is required");
});

test("pageArg rejects a page outside 1 to 10000", () => {
  expect(() => pageArg(new URL("http://localhost/api/x?page=0"))).toThrow(
    "Page must be between 1 and 10000",
  );
  expect(pageArg(new URL("http://localhost/api/x"))).toBe(1);
});

test("paginate slices and counts pages", () => {
  const page = paginate(Array.from({ length: 45 }, (_, i) => i), 3, 20);
  expect(page.items).toHaveLength(5);
  expect(page).toMatchObject({ page: 3, pages: 3, total: 45 });
});

test("only unhandled api requests are flagged", () => {
  expect(isUnhandledApiRequest(new Request("http://localhost/api/x"))).toBe(true);
  expect(isUnhandledApiRequest(new Request("http://localhost/src/main.tsx"))).toBe(false);
});

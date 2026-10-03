import { describe, expect, it, vi } from "vitest";
import { mockFetch } from "../test/fetch";
import { api, ApiError, errorMessage } from "./client";

describe("api client", () => {
  it("returns parsed json", async () => {
    mockFetch({ "GET /api/auth/me": { body: { user: null } } });

    await expect(api.get("/auth/me")).resolves.toEqual({ user: null });
  });

  it("sends json bodies", async () => {
    const fetchMock = mockFetch({ "PUT /api/ratings": (body) => ({ body }) });

    await expect(api.put("/ratings", { stars: 4 })).resolves.toEqual({ stars: 4 });
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("resolves empty responses", async () => {
    mockFetch({ "POST /api/auth/logout": { status: 204 } });

    await expect(api.post("/auth/logout")).resolves.toBeUndefined();
  });

  it("throws api errors with code and message", async () => {
    mockFetch({
      "GET /api/songs/x": { status: 404, body: { error: { code: "not_found", message: "Song not found" } } },
    });

    const error = await api.get("/songs/x").catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: "not_found", message: "Song not found" });
  });

  it("explains an unreachable server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await api.get("/auth/me").catch((caught) => caught);

    expect(errorMessage(error)).toBe("Could not reach the server, check that the API is running");
  });
});

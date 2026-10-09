import { describe, expect, it } from "vitest";
import { authHref, loginHref, safeNext } from "./redirects";

describe("redirects", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/albums/abc?page=2")).toBe("/albums/abc?page=2");
  });

  it("drops anything that could leave the site", () => {
    for (const next of [null, "", "albums", "//evil.com", "/\\evil.com", "https://evil.com"]) {
      expect(safeNext(next)).toBeNull();
    }
  });

  it("carries next through auth links", () => {
    expect(authHref("/register", "/songs/x?y=1")).toBe("/register?next=%2Fsongs%2Fx%3Fy%3D1");
    expect(authHref("/login", null)).toBe("/login");
    expect(loginHref("/playlists/3")).toBe("/login?next=%2Fplaylists%2F3");
  });
});

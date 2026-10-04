import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockFetch } from "../test/fetch";
import { renderAt } from "../test/render";

describe("router", () => {
  it("shows not found for unknown paths inside the shell", async () => {
    mockFetch({ "GET /api/auth/me": { body: { user: null } } });
    renderAt("/no-such-page");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "TrackmyTracks" })).toHaveAttribute("href", "/");
  });

  it("closes every page with the footer", async () => {
    mockFetch({ "GET /api/auth/me": { body: { user: null } } });
    renderAt("/no-such-page");

    expect(await screen.findByRole("contentinfo")).toHaveTextContent("Rate it. Review it. Replay it.");
  });
});

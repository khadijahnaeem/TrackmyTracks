import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockFetch } from "../../test/fetch";
import { renderWithProviders } from "../../test/render";
import { AccountNav } from "./AccountNav";

describe("AccountNav", () => {
  it("offers log in and sign up when logged out", async () => {
    mockFetch({ "GET /api/auth/me": { body: { user: null } } });
    renderWithProviders(<AccountNav />);

    expect(await screen.findByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/register");
  });

  it("links the user's pages and logs out", async () => {
    mockFetch({
      "GET /api/auth/me": { body: { user: { id: 1, username: "alice", email: "a@b.co" } } },
      "GET /api/friends": { body: { friends: [], incoming: [], outgoing: [] } },
      "POST /api/auth/logout": { status: 204 },
    });
    renderWithProviders(<AccountNav />);

    expect(await screen.findByRole("link", { name: "History" })).toHaveAttribute(
      "href",
      "/users/alice/history",
    );
    expect(screen.getByRole("link", { name: "Playlists" })).toHaveAttribute(
      "href",
      "/users/alice/playlists",
    );

    expect(screen.getByRole("link", { name: "Friends" })).toHaveAttribute("href", "/friends");

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("link", { name: "Log in" })).toBeInTheDocument();
  });

  it("badges the Friends link with the incoming request count", async () => {
    mockFetch({
      "GET /api/auth/me": { body: { user: { id: 1, username: "alice", email: "a@b.co" } } },
      "GET /api/friends": {
        body: {
          friends: [],
          incoming: [{ user: { username: "maya" }, sent_at: "2026-10-02T18:30:00+00:00" }],
          outgoing: [],
        },
      },
    });
    renderWithProviders(<AccountNav />);

    expect(await screen.findByRole("link", { name: "Friends, 1 request" })).toHaveAttribute("href", "/friends");
  });
});

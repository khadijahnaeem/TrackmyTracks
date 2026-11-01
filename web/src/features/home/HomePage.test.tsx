import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { mockFetch } from "../../test/fetch";
import { renderAt } from "../../test/render";

const searchParam = (search: string) => new URLSearchParams(search).get("q");

describe("HomePage", () => {
  beforeEach(() => {
    mockFetch({ "GET /api/auth/me": { body: { user: null } } });
  });

  it("renders the home page at the root", async () => {
    renderAt("/");

    expect(await screen.findByRole("heading", { level: 1, name: "TrackmyTracks" })).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(document.title).toBe("TrackmyTracks");
  });

  it("searches from the hero", async () => {
    const { router } = renderAt("/");

    await userEvent.type(await screen.findByLabelText("Search music"), "AC/DC & co");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(router.state.location.pathname).toBe("/search");
    expect(searchParam(router.state.location.search)).toBe("AC/DC & co");
  });

  it("submits with the enter key", async () => {
    const { router } = renderAt("/");

    await userEvent.type(await screen.findByLabelText("Search music"), "radiohead{Enter}");

    expect(searchParam(router.state.location.search)).toBe("radiohead");
  });

  it("ignores a blank search", async () => {
    const { router } = renderAt("/");

    await userEvent.type(await screen.findByLabelText("Search music"), "   {Enter}");

    expect(router.state.location.pathname).toBe("/");
  });

  it("restores the tab title after another page", async () => {
    const { router } = renderAt("/no-such-page");
    await screen.findByRole("heading", { name: "Page not found" });

    await router.navigate("/");

    expect(await screen.findByRole("heading", { level: 1, name: "TrackmyTracks" })).toBeInTheDocument();
    expect(document.title).toBe("TrackmyTracks");
  });

  it("shows trending tracks with community ratings", async () => {
    renderAt("/");

    const trending = await screen.findByRole("region", { name: "Trending Tracks" });
    for (const title of ["Midnight Drive", "After Hours", "Electric Blue", "Replay"]) {
      expect(within(trending).getByText(title)).toBeInTheDocument();
    }
    expect(within(trending).getByRole("img", { name: "Community rating: 4.4 out of 5" })).toBeInTheDocument();
  });

  it("shows fresh reviews from the community", async () => {
    renderAt("/");

    const reviews = await screen.findByRole("region", { name: "Fresh Reviews" });
    expect(within(reviews).getByText("@khadijah")).toBeInTheDocument();
    expect(within(reviews).getByText("Exactly what I want from a late-night playlist.")).toBeInTheDocument();
    expect(within(reviews).getAllByRole("img", { name: /^Rating: / })).toHaveLength(3);
  });

  it("caps a pasted search at the api query length", async () => {
    const { router } = renderAt("/");

    await userEvent.click(await screen.findByLabelText("Search music"));
    await userEvent.paste("a".repeat(205));
    await userEvent.keyboard("{Enter}");

    expect(searchParam(router.state.location.search)).toHaveLength(200);
  });

  it("leads with the search form and no feature blurbs", async () => {
    renderAt("/");

    expect(await screen.findByRole("search")).toBeInTheDocument();
    expect(screen.queryByText("Rate your favorites")).not.toBeInTheDocument();
  });

  describe("when logged in", () => {
    const ME = { user: { id: 1, username: "alex", email: "alex@example.com" } };
    const radiohead = { mbid: "a1", name: "Radiohead" };
    const feedPage = (items: unknown[]) => ({ body: { items, page: 1, pages: 1, total: items.length } });

    it("shows friends activity", async () => {
      mockFetch({
        "GET /api/auth/me": { body: ME },
        "GET /api/feed?page=1": feedPage([
          {
            id: 1,
            kind: "song",
            item: { mbid: "s1", title: "Paranoid Android", disambiguation: null, length_ms: null, artist: radiohead },
            stars: 4.5,
            review: "Three songs in one.",
            updated_at: "2026-10-02T18:30:00+00:00",
            user: { username: "sam" },
          },
        ]),
      });
      renderAt("/");

      const activity = await screen.findByRole("region", { name: "Friends' Activity" });
      expect(await within(activity).findByRole("link", { name: "@sam" })).toHaveAttribute("href", "/users/sam/history");
      expect(within(activity).getByRole("link", { name: "Paranoid Android" })).toHaveAttribute("href", "/songs/s1");
      expect(within(activity).getByRole("link", { name: "Radiohead" })).toHaveAttribute("href", "/artists/a1");
      expect(within(activity).getByText("Three songs in one.")).toBeInTheDocument();
      expect(within(activity).queryByText("Song")).toBeNull();
      expect(within(activity).getByRole("img", { name: "Rating: 4.5 out of 5" })).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Fresh Reviews" })).not.toBeInTheDocument();
    });

    it("links album and artist cards to their pages", async () => {
      mockFetch({
        "GET /api/auth/me": { body: ME },
        "GET /api/feed?page=1": feedPage([
          {
            id: 2,
            kind: "album",
            item: { mbid: "b1", title: "OK Computer", release_year: 1997, artist: radiohead },
            stars: 5,
            review: null,
            updated_at: "2026-10-02T18:30:00+00:00",
            user: { username: "sam" },
          },
          {
            id: 3,
            kind: "artist",
            item: radiohead,
            stars: 4,
            review: null,
            updated_at: "2026-10-02T18:30:00+00:00",
            user: { username: "maya" },
          },
        ]),
      });
      renderAt("/");

      const activity = await screen.findByRole("region", { name: "Friends' Activity" });
      expect(await within(activity).findByRole("link", { name: "OK Computer" })).toHaveAttribute("href", "/albums/b1");
      expect(within(activity).getByText("Album")).toBeInTheDocument();
      expect(within(activity).getByText("Artist")).toBeInTheDocument();
      expect(within(activity).getAllByRole("link", { name: "Radiohead" })[0]).toHaveAttribute("href", "/artists/a1");
    });

    it("shows a notice with no activity", async () => {
      mockFetch({ "GET /api/auth/me": { body: ME }, "GET /api/feed?page=1": feedPage([]) });
      renderAt("/");

      expect(await screen.findByText("Nothing from friends yet")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Find friends" })).toHaveAttribute("href", "/friends");
    });

    it("pages through the feed", async () => {
      const entry = (id: number, title: string) => ({
        id,
        kind: "artist",
        item: { mbid: `m${id}`, name: title },
        stars: 3,
        review: null,
        updated_at: "2026-10-02T18:30:00+00:00",
        user: { username: "sam" },
      });
      mockFetch({
        "GET /api/auth/me": { body: ME },
        "GET /api/feed?page=1": { body: { items: [entry(1, "First Band")], page: 1, pages: 2, total: 2 } },
        "GET /api/feed?page=2": { body: { items: [entry(2, "Second Band")], page: 2, pages: 2, total: 2 } },
      });
      renderAt("/");

      await screen.findByRole("link", { name: "First Band" });
      await userEvent.click(screen.getByRole("button", { name: "Next" }));

      expect(await screen.findByRole("link", { name: "Second Band" })).toBeInTheDocument();
    });
  });

  it("keeps Fresh Reviews logged out without asking for the feed", async () => {
    const fetchMock = mockFetch({ "GET /api/auth/me": { body: { user: null } } });
    renderAt("/");

    expect(await screen.findByRole("region", { name: "Fresh Reviews" })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.anything()));
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/feed"))).toBe(false);
  });
});

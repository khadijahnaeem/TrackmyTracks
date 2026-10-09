import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { HistoryEntry, Page } from "../../api/types";
import { mockFetch } from "../../test/fetch";
import { renderAt } from "../../test/render";

const RADIOHEAD = { mbid: "a1", name: "Radiohead" };
const ENTRIES: HistoryEntry[] = [
  {
    id: 2,
    kind: "album",
    item: { mbid: "b1", title: "OK Computer", release_year: 1997, artist: RADIOHEAD },
    stars: 4.5,
    review: "Better as a whole",
    updated_at: "2026-10-02T18:30:00+00:00",
  },
  { id: 1, kind: "artist", item: RADIOHEAD, stars: 5, review: null, updated_at: "2026-10-01T09:00:00+00:00" },
];
const ALICE_USER = { id: 1, username: "alice", email: "alice@example.com" };
const LOGGED_OUT = { "GET /api/auth/me": { body: { user: null } } };
const ALICE = { "GET /api/auth/me": { body: { user: ALICE_USER } } };

function pageOf(items: HistoryEntry[], overrides: Partial<Page<HistoryEntry>> = {}): Page<HistoryEntry> {
  return { items, page: 1, pages: 1, total: items.length, ...overrides };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("HistoryPage", () => {
  it("lists rated items with stars, dates, and reviews", async () => {
    mockFetch({ ...LOGGED_OUT, "GET /api/users/alice/history?page=1": { body: pageOf(ENTRIES) } });
    renderAt("/users/alice/history");

    expect(await screen.findByRole("link", { name: "OK Computer" })).toHaveAttribute("href", "/albums/b1");
    expect(screen.getByRole("heading", { level: 1, name: "alice" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Rating: 4.5 out of 5" })).toBeInTheDocument();
    expect(screen.getByText("Better as a whole")).toBeInTheDocument();
    expect(screen.getByText("Oct 2, 2026")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Radiohead" })).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("2 ratings");
  });

  it("filters by kind through the url", async () => {
    const fetchMock = mockFetch({
      ...LOGGED_OUT,
      "GET /api/users/alice/history?page=1": { body: pageOf(ENTRIES) },
      "GET /api/users/alice/history?kind=album&page=1": { body: pageOf([ENTRIES[0]]) },
    });
    renderAt("/users/alice/history");

    await userEvent.click(await screen.findByRole("button", { name: "Albums" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/users/alice/history?kind=album&page=1", expect.anything()),
    );
    expect(screen.getByRole("button", { name: "Albums" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the skeleton on a filter change instead of the previous list", async () => {
    const album = deferred<{ body: Page<HistoryEntry> }>();
    mockFetch({
      ...LOGGED_OUT,
      "GET /api/users/alice/history?page=1": { body: pageOf(ENTRIES) },
      "GET /api/users/alice/history?kind=album&page=1": () => album.promise,
    });
    renderAt("/users/alice/history");

    await userEvent.click(await screen.findByRole("button", { name: "Albums" }));

    expect(screen.getByLabelText("Loading history")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("link", { name: "OK Computer" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    album.resolve({ body: pageOf([ENTRIES[0]]) });
    expect(await screen.findByRole("link", { name: "OK Computer" })).toBeInTheDocument();
  });

  it("invites the owner to rate something when empty", async () => {
    mockFetch({ ...ALICE, "GET /api/users/alice/history?page=1": { body: pageOf([]) } });
    renderAt("/users/alice/history");

    expect(await screen.findByText("Nothing rated yet")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1, name: "Your history" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search music" })).toHaveAttribute("href", "/search");
  });

  it("tells visitors when the user has not rated anything", async () => {
    mockFetch({ ...LOGGED_OUT, "GET /api/users/alice/history?page=1": { body: pageOf([]) } });
    renderAt("/users/alice/history");

    expect(await screen.findByText("alice has not rated anything yet")).toBeInTheDocument();
  });

  it("explains an unknown user", async () => {
    mockFetch({
      ...LOGGED_OUT,
      "GET /api/users/ghost/history?page=1": {
        status: 404,
        body: { error: { code: "not_found", message: "User not found" } },
      },
    });
    renderAt("/users/ghost/history");

    expect(await screen.findByRole("heading", { level: 1, name: "User not found" })).toBeInTheDocument();
    expect(document.title).toBe("User not found | TrackmyTracks");
    expect(screen.getByText("No user named ghost")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search music" })).toHaveAttribute("href", "/search");
  });

  it("shows a skeleton and loading title while the viewer is unknown", async () => {
    const me = deferred<{ body: unknown }>();
    mockFetch({
      "GET /api/auth/me": () => me.promise,
      "GET /api/users/alice/history?page=1": { body: pageOf([]) },
    });
    renderAt("/users/alice/history");

    expect(screen.getByLabelText("Loading history")).toHaveAttribute("aria-busy", "true");
    expect(document.title).toBe("Loading | TrackmyTracks");
    await waitFor(() => expect(screen.getByLabelText("Loading history")).toBeInTheDocument());
    expect(screen.queryByText("Nothing rated yet")).not.toBeInTheDocument();
    expect(screen.queryByText("alice has not rated anything yet")).not.toBeInTheDocument();

    me.resolve({ body: { user: ALICE_USER } });
    expect(await screen.findByText("Nothing rated yet")).toBeInTheDocument();
  });

  it("shows a header above a generic error and retries", async () => {
    let calls = 0;
    mockFetch({
      ...LOGGED_OUT,
      "GET /api/users/alice/history?page=1": () =>
        ++calls === 1
          ? { status: 502, body: { error: { code: "bad_gateway", message: "Upstream down" } } }
          : { body: pageOf(ENTRIES) },
    });
    renderAt("/users/alice/history");

    expect(await screen.findByRole("heading", { level: 1, name: "alice" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load this history");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: "OK Computer" })).toBeInTheDocument();
  });

  describe("paging", () => {
    const FIRST = pageOf([ENTRIES[0]], { pages: 2, total: 21 });
    const SECOND = pageOf([ENTRIES[1]], { page: 2, pages: 2, total: 21 });

    it("announces totals and pages", async () => {
      mockFetch({ ...LOGGED_OUT, "GET /api/users/alice/history?page=1": { body: FIRST } });
      renderAt("/users/alice/history");

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("21 ratings, page 1 of 2"));
    });

    it("dims the list, disables paging, then focuses the results heading", async () => {
      const second = deferred<{ body: Page<HistoryEntry> }>();
      mockFetch({
        ...LOGGED_OUT,
        "GET /api/users/alice/history?page=1": { body: FIRST },
        "GET /api/users/alice/history?page=2": () => second.promise,
      });
      const { router } = renderAt("/users/alice/history");
      expect(await screen.findByRole("link", { name: "OK Computer" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2, name: "Results" })).not.toHaveFocus();

      await userEvent.click(screen.getByRole("button", { name: "Next" }));

      expect(router.state.location.search).toBe("?page=2");
      expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true");
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
      expect(screen.getByRole("link", { name: "OK Computer" })).toBeInTheDocument();
      expect(screen.getByRole("status")).toBeEmptyDOMElement();

      second.resolve({ body: SECOND });
      await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: "Results" })).toHaveFocus());
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("list")).not.toHaveAttribute("aria-busy");
      expect(screen.getByRole("status")).toHaveTextContent("21 ratings, page 2 of 2");
    });

    it("leaves focus alone after a filter change", async () => {
      mockFetch({
        ...LOGGED_OUT,
        "GET /api/users/alice/history?page=1": { body: FIRST },
        "GET /api/users/alice/history?kind=album&page=1": { body: pageOf([ENTRIES[0]]) },
      });
      renderAt("/users/alice/history");

      await userEvent.click(await screen.findByRole("button", { name: "Albums" }));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("1 rating"));

      expect(screen.getByRole("heading", { level: 2, name: "Results" })).not.toHaveFocus();
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
      expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(1);
    });
  });
});

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockFetch } from "../../test/fetch";
import { renderAt } from "../../test/render";
import { karmaPolice, OK_COMPUTER, okComputer, pageOf } from "./test-data";

const ME = { "GET /api/auth/me": { body: { user: null } } };

const KARMA_PAGES = {
  "GET /api/search?type=song&q=karma&page=1": {
    body: { ...pageOf([karmaPolice], 3), total: 3 },
  },
  "GET /api/search?type=song&q=karma&page=2": {
    body: {
      ...pageOf([{ ...karmaPolice, mbid: "second", title: "Karma Police (live)" }], 3),
      page: 2,
      total: 3,
    },
  },
};

describe("SearchPage", () => {
  it("invites a search before there is a query", async () => {
    const fetchMock = mockFetch(ME);

    renderAt("/search");

    expect(await screen.findByText("Search millions of songs, albums, and artists")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/search"))).toBe(false);
  });

  it("puts the query in the url and lists songs", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=karma+police&page=1": {
        body: pageOf([{ ...karmaPolice, disambiguation: "live, 1997" }]),
      },
    });
    const { router } = renderAt("/search");

    await userEvent.type(screen.getByLabelText("Search music"), "karma police");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByRole("link", { name: "Karma Police" })).toHaveAttribute(
      "href",
      `/songs/${karmaPolice.mbid}`,
    );
    expect(screen.getByText("live, 1997")).toBeInTheDocument();
    expect(screen.getByText("4:22")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?type=song&q=karma+police");
  });

  it("says how often each song was played, and stays quiet for unplayed ones", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=karma&page=1": {
        body: pageOf([
          { ...karmaPolice, listens: 3893589 },
          { ...karmaPolice, mbid: "cover", title: "Karma Police (cover)", listens: 0 },
        ]),
      },
    });

    renderAt("/search?type=song&q=karma");

    expect(await screen.findByText("3.9M listens")).toBeInTheDocument();
    expect(screen.queryByText(/0 listens/)).not.toBeInTheDocument();
  });

  it("says how often each artist was played", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=artist&q=radiohead&page=1": {
        body: pageOf([
          { mbid: "radiohead", name: "Radiohead", listens: 134659628 },
          { mbid: "gazz", name: "Gazz", listens: 0 },
        ]),
      },
    });

    renderAt("/search?type=artist&q=radiohead");

    expect(await screen.findByText("134.7M listens")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gazz" })).toBeInTheDocument();
    expect(screen.queryByText(/0 listens/)).not.toBeInTheDocument();
  });

  it("shows skeleton rows while results load", () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=karma&page=1": {
        body: pageOf([karmaPolice]),
      },
    });

    renderAt("/search?q=karma");

    expect(screen.getByLabelText("Loading results")).toHaveAttribute("aria-busy", "true");
  });

  it("switches result type from the segmented control", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=ok+computer&page=1": {
        body: pageOf([karmaPolice]),
      },
      "GET /api/search?type=album&q=ok+computer&page=1": {
        body: pageOf([okComputer]),
      },
    });
    renderAt("/search?q=ok+computer");

    await userEvent.click(await screen.findByRole("button", { name: "Albums" }));

    expect(await screen.findByRole("link", { name: "OK Computer" })).toHaveAttribute("href", `/albums/${OK_COMPUTER}`);
    expect(screen.getByText("1997")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Albums" })).toHaveAttribute("aria-pressed", "true");
  });

  it("explains an empty result", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=zzzz&page=1": { body: pageOf([]) },
    });

    renderAt("/search?q=zzzz");

    expect(await screen.findByText("Check the spelling, or try another result type.")).toBeInTheDocument();
  });

  it("shows a catalog outage with a retry", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=karma&page=1": {
        status: 502,
        body: {
          error: {
            code: "catalog_unavailable",
            message: "Music catalog is unavailable, try again",
          },
        },
      },
    });

    renderAt("/search?q=karma");

    expect(await screen.findByRole("alert")).toHaveTextContent("Music catalog is unavailable, try again");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("pages through results", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=karma&page=1": {
        body: pageOf([karmaPolice], 3),
      },
      "GET /api/search?type=song&q=karma&page=2": {
        body: {
          ...pageOf([{ ...karmaPolice, mbid: "second", title: "Karma Police (live)" }], 3),
          page: 2,
        },
      },
    });
    const { router } = renderAt("/search?q=karma");

    await userEvent.click(await screen.findByRole("button", { name: "Next" }));

    expect(await screen.findByRole("link", { name: "Karma Police (live)" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("?type=song&q=karma&page=2");
  });

  it("moves focus to the results heading after paging", async () => {
    mockFetch({ ...ME, ...KARMA_PAGES });
    renderAt("/search?q=karma");

    await userEvent.click(await screen.findByRole("button", { name: "Next" }));
    await screen.findByRole("link", { name: "Karma Police (live)" });

    const heading = screen.getByRole("heading", { name: "Results" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByLabelText("Search music")).not.toHaveFocus();
    expect(heading.scrollIntoView).toHaveBeenCalled();
  });

  it("leaves focus alone on first load", async () => {
    mockFetch({ ...ME, ...KARMA_PAGES });
    renderAt("/search?q=karma");

    await screen.findByRole("link", { name: "Karma Police" });

    expect(document.body).toHaveFocus();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("shows the skeleton, never song rows, while another type loads", async () => {
    let releaseAlbums: (reply: { body: unknown }) => void = () => {};
    const albums = new Promise<{ body: unknown }>((resolve) => (releaseAlbums = resolve));
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=ok&page=1": { body: pageOf([karmaPolice]) },
      "GET /api/search?type=album&q=ok&page=1": () => albums,
    });
    renderAt("/search?q=ok");

    await userEvent.click(await screen.findByRole("button", { name: "Albums" }));

    expect(screen.getByLabelText("Loading results")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Karma Police" })).not.toBeInTheDocument();
    releaseAlbums({ body: pageOf([okComputer]) });
    expect(await screen.findByRole("link", { name: "OK Computer" })).toBeInTheDocument();
  });

  it("announces result count and page", async () => {
    mockFetch({ ...ME, ...KARMA_PAGES });
    renderAt("/search?q=karma");

    await screen.findByRole("link", { name: "Karma Police" });

    expect(screen.getByRole("status")).toHaveTextContent('3 results for "karma", page 1 of 3');
  });

  it("announces a single result without a page", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=karma&page=1": {
        body: pageOf([karmaPolice]),
      },
    });
    renderAt("/search?q=karma");

    await screen.findByRole("link", { name: "Karma Police" });

    expect(screen.getByRole("status")).toHaveTextContent(/^1 result for "karma"$/);
  });

  it("announces zero results", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=zzzz&page=1": { body: pageOf([]) },
    });
    renderAt("/search?q=zzzz");

    await screen.findByText("Check the spelling, or try another result type.");

    expect(screen.getByText('No results for "zzzz"', { selector: "p.visually-hidden" })).toBeInTheDocument();
  });

  it("handles out of range pages by showing a back link", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=karma&page=99": { body: pageOf([], 3) },
    });
    renderAt("/search?q=karma&page=99");

    expect(await screen.findByText("Past the end")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to page 1" })).toHaveAttribute("href", "/search?type=song&q=karma");
  });
});

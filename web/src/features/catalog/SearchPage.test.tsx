import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockFetch } from "../../test/fetch";
import { renderAt } from "../../test/render";
import { karmaPolice, OK_COMPUTER, okComputer, pageOf } from "./test-data";

const ME = { "GET /api/auth/me": { body: { user: null } } };

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

  it("shows skeleton rows while results load", () => {
    mockFetch({ ...ME, "GET /api/search?type=song&q=karma&page=1": { body: pageOf([karmaPolice]) } });

    renderAt("/search?q=karma");

    expect(screen.getByLabelText("Loading results")).toHaveAttribute("aria-busy", "true");
  });

  it("switches result type from the segmented control", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=ok+computer&page=1": { body: pageOf([karmaPolice]) },
      "GET /api/search?type=album&q=ok+computer&page=1": { body: pageOf([okComputer]) },
    });
    renderAt("/search?q=ok+computer");

    await userEvent.click(await screen.findByRole("button", { name: "Albums" }));

    expect(await screen.findByRole("link", { name: "OK Computer" })).toHaveAttribute(
      "href",
      `/albums/${OK_COMPUTER}`,
    );
    expect(screen.getByText("1997")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Albums" })).toHaveAttribute("aria-pressed", "true");
  });

  it("explains an empty result", async () => {
    mockFetch({ ...ME, "GET /api/search?type=song&q=zzzz&page=1": { body: pageOf([]) } });

    renderAt("/search?q=zzzz");

    expect(await screen.findByText('No results for "zzzz"')).toBeInTheDocument();
  });

  it("shows a catalog outage with a retry", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=karma&page=1": {
        status: 502,
        body: { error: { code: "catalog_unavailable", message: "Music catalog is unavailable, try again" } },
      },
    });

    renderAt("/search?q=karma");

    expect(await screen.findByRole("alert")).toHaveTextContent("Music catalog is unavailable, try again");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("pages through results", async () => {
    mockFetch({
      ...ME,
      "GET /api/search?type=song&q=karma&page=1": { body: pageOf([karmaPolice], 3) },
      "GET /api/search?type=song&q=karma&page=2": {
        body: { ...pageOf([{ ...karmaPolice, mbid: "second", title: "Karma Police (live)" }], 3), page: 2 },
      },
    });
    const { router } = renderAt("/search?q=karma");

    await userEvent.click(await screen.findByRole("button", { name: "Next" }));

    expect(await screen.findByRole("link", { name: "Karma Police (live)" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("?type=song&q=karma&page=2");
  });
});

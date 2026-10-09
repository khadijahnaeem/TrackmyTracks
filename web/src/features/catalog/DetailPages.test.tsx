import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Kind } from "../../api/types";
import { mockFetch } from "../../test/fetch";
import { renderAt } from "../../test/render";
import {
  albumDetail,
  artistDetail,
  KARMA_POLICE,
  OK_COMPUTER,
  pageOf,
  RADIOHEAD,
  songDetail,
} from "./test-data";

const ME = { "GET /api/auth/me": { body: { user: null } } };

function noReviews(kind: Kind, mbid: string) {
  return { [`GET /api/${kind}s/${mbid}/reviews?page=1`]: { body: pageOf([]) } };
}

describe("catalog detail pages", () => {
  it("shows an artist with popular songs and albums", async () => {
    mockFetch({
      ...ME,
      ...noReviews("artist", RADIOHEAD),
      [`GET /api/artists/${RADIOHEAD}`]: { body: artistDetail },
    });

    renderAt(`/artists/${RADIOHEAD}`);

    expect(await screen.findByRole("heading", { level: 1, name: "Radiohead" })).toBeInTheDocument();
    expect(document.title).toBe("Radiohead | TrackmyTracks");
    const popular = screen.getByRole("region", { name: "Popular songs" });
    expect(within(popular).getByRole("link", { name: "Karma Police" })).toHaveAttribute(
      "href",
      `/songs/${KARMA_POLICE}`,
    );
    expect(within(popular).getByText("4:22")).toBeInTheDocument();
    const albums = screen.getByRole("region", { name: "Albums" });
    expect(within(albums).getByRole("link", { name: "In Rainbows" })).toHaveAttribute(
      "href",
      "/albums/6e335887-60ba-38f0-95af-fae7774336bf",
    );
    expect(screen.getByRole("region", { name: "Reviews" })).toBeInTheDocument();
  });

  it("shows an album with its artist, year, and tracklist", async () => {
    mockFetch({
      ...ME,
      ...noReviews("album", OK_COMPUTER),
      [`GET /api/albums/${OK_COMPUTER}`]: { body: albumDetail },
    });

    renderAt(`/albums/${OK_COMPUTER}`);

    expect(await screen.findByRole("heading", { level: 1, name: "OK Computer" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Radiohead" })).toHaveAttribute("href", `/artists/${RADIOHEAD}`);
    expect(screen.getByText("1997")).toBeInTheDocument();
    const tracklist = screen.getByRole("region", { name: "Tracklist" });
    expect(within(tracklist).getByRole("link", { name: "Airbag" })).toBeInTheDocument();
    expect(within(tracklist).getByRole("link", { name: "Paranoid Android" })).toBeInTheDocument();
    expect(within(tracklist).getByText("6:24")).toBeInTheDocument();
  });

  it("shows a song with its artist and length", async () => {
    mockFetch({
      ...ME,
      ...noReviews("song", KARMA_POLICE),
      [`GET /api/songs/${KARMA_POLICE}`]: { body: songDetail },
    });

    renderAt(`/songs/${KARMA_POLICE}`);

    expect(await screen.findByRole("heading", { level: 1, name: "Karma Police" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Radiohead" })).toHaveAttribute("href", `/artists/${RADIOHEAD}`);
    expect(screen.getByText("4:22")).toBeInTheDocument();
  });

  it("shows a skeleton while loading", () => {
    mockFetch({ ...ME, [`GET /api/albums/${OK_COMPUTER}`]: { body: albumDetail } });

    renderAt(`/albums/${OK_COMPUTER}`);

    expect(screen.getByRole("status", { name: "Loading" })).toHaveAttribute("aria-busy", "true");
    expect(document.title).toBe("Loading | TrackmyTracks");
  });

  it("explains an entry missing from the catalog", async () => {
    mockFetch({
      ...ME,
      [`GET /api/albums/${OK_COMPUTER}`]: {
        status: 404,
        body: { error: { code: "not_found", message: "Not found in the music catalog" } },
      },
    });

    renderAt(`/albums/${OK_COMPUTER}`);

    expect(await screen.findByRole("heading", { level: 1, name: "Not in the music catalog" })).toBeInTheDocument();
    expect(document.title).toBe("Not in the music catalog | TrackmyTracks");
    expect(screen.getByRole("status")).toHaveTextContent("This entry is gone");
    expect(screen.getByRole("status")).toHaveTextContent("MusicBrainz may have removed or merged this entry.");
    expect(screen.getByRole("link", { name: "Search music" })).toHaveAttribute("href", "/search");
  });

  it("retries after a catalog outage", async () => {
    let calls = 0;
    mockFetch({
      ...ME,
      ...noReviews("song", KARMA_POLICE),
      [`GET /api/songs/${KARMA_POLICE}`]: () =>
        ++calls === 1
          ? {
              status: 502,
              body: { error: { code: "catalog_unavailable", message: "Music catalog is unavailable, try again" } },
            }
          : { body: songDetail },
    });
    renderAt(`/songs/${KARMA_POLICE}`);

    expect(await screen.findByRole("heading", { level: 1, name: "Something went wrong" })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Karma Police" })).toBeInTheDocument();
  });

  it("shows the derived album rating after rating a track", async () => {
    let albumCalls = 0;
    const derived = {
      mine: { stars: 5, is_derived: true, song_count: 1, review: null },
      community: { stars: 5, count: 1 },
    };
    const fetchMock = mockFetch({
      "GET /api/auth/me": { body: { user: { id: 1, username: "alice", email: "alice@example.com" } } },
      ...noReviews("album", OK_COMPUTER),
      [`GET /api/albums/${OK_COMPUTER}`]: () => ({
        body: ++albumCalls === 1 ? albumDetail : { ...albumDetail, album: { ...albumDetail.album, rating: derived } },
      }),
      "PUT /api/ratings": { body: { mbid: albumDetail.tracks[0].mbid, rating: derived } },
    });
    renderAt(`/albums/${OK_COMPUTER}`);

    const slider = await screen.findByRole("slider", { name: "Your rating for Airbag" });
    slider.focus();
    await userEvent.keyboard("{End}");

    expect(await screen.findByText(/average of your 1 song rating/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/ratings", expect.objectContaining({ method: "PUT" }));
  });
});

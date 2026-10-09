import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Playlist, PlaylistDetail } from "../../api/types";
import { mockFetch } from "../../test/fetch";
import { renderWithProviders } from "../../test/render";
import { AddToPlaylistButton } from "./AddToPlaylistButton";

const MBID = "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3";
const ALICE = { id: 1, username: "alice", email: "alice@example.com" };

function playlist(id: number, name: string): Playlist {
  return {
    id,
    name,
    description: null,
    is_public: true,
    owner: { username: "alice" },
    song_count: 0,
    updated_at: "2026-10-02T18:30:00+00:00",
  };
}

function detail(id: number, name: string): PlaylistDetail {
  return { ...playlist(id, name), song_count: 1, songs: [] };
}

function loggedIn(playlists: Playlist[]) {
  return {
    "GET /api/auth/me": { body: { user: ALICE } },
    "GET /api/users/alice/playlists": { body: { items: playlists } },
  };
}

async function openPicker() {
  // the disabled placeholder shown while loading has no aria-expanded
  await userEvent.click(
    await screen.findByRole("button", { name: "Add to playlist", expanded: false }),
  );
}

describe("AddToPlaylistButton", () => {
  it("asks logged out visitors to log in and come back", async () => {
    mockFetch({ "GET /api/auth/me": { body: { user: null } } });
    renderWithProviders(<AddToPlaylistButton mbid={MBID} />, { path: "/songs/abc" });

    expect(await screen.findByRole("link", { name: "Log in to add" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsongs%2Fabc",
    );
  });

  it("adds the song to a chosen playlist", async () => {
    mockFetch({
      ...loggedIn([playlist(1, "Late nights")]),
      "POST /api/playlists/1/songs": { status: 201, body: detail(1, "Late nights") },
    });
    renderWithProviders(<AddToPlaylistButton mbid={MBID} />);

    await openPicker();
    await userEvent.click(await screen.findByRole("button", { name: "Late nights" }));

    expect(await screen.findByRole("button", { name: "Late nights Added" })).toBeDisabled();
  });

  it("reports a song that is already there", async () => {
    mockFetch({
      ...loggedIn([playlist(1, "Late nights")]),
      "POST /api/playlists/1/songs": {
        status: 409,
        body: { error: { code: "conflict", message: "Song is already in this playlist" } },
      },
    });
    renderWithProviders(<AddToPlaylistButton mbid={MBID} />);

    await openPicker();
    await userEvent.click(await screen.findByRole("button", { name: "Late nights" }));

    expect(await screen.findByRole("button", { name: "Late nights Already added" })).toBeDisabled();
  });

  it("creates a playlist and adds the song in one step", async () => {
    const fetchMock = mockFetch({
      ...loggedIn([]),
      "POST /api/playlists": { status: 201, body: playlist(2, "Road trip") },
      "POST /api/playlists/2/songs": { status: 201, body: detail(2, "Road trip") },
    });
    renderWithProviders(<AddToPlaylistButton mbid={MBID} />);

    await openPicker();
    expect(await screen.findByText("No playlists yet, create one below.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("New playlist"), "Road trip");
    await userEvent.click(screen.getByRole("button", { name: "Create and add" }));

    expect(await screen.findByText("Added to Road trip")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/playlists",
      expect.objectContaining({
        body: JSON.stringify({ name: "Road trip", description: null, is_public: true }),
      }),
    );
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    mockFetch(loggedIn([]));
    renderWithProviders(<AddToPlaylistButton mbid={MBID} />);

    await openPicker();
    expect(screen.getByRole("dialog", { name: "Add to playlist" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to playlist" })).toHaveFocus();
  });

  it("closes on a click outside", async () => {
    mockFetch(loggedIn([]));
    renderWithProviders(<AddToPlaylistButton mbid={MBID} />);

    await openPicker();
    await userEvent.click(document.body);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

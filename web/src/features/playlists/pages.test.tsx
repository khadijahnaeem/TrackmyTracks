import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Playlist, PlaylistDetail, SongSummary } from "../../api/types";
import { mockFetch } from "../../test/fetch";
import { renderAt } from "../../test/render";
import type { PlaylistFields } from "./api";

const ALICE = { id: 1, username: "alice", email: "alice@example.com" };
const ME_ALICE = { "GET /api/auth/me": { body: { user: ALICE } } };
const ME_NOBODY = { "GET /api/auth/me": { body: { user: null } } };

function song(mbid: string, title: string): SongSummary {
  return {
    mbid,
    title,
    disambiguation: null,
    length_ms: 284400,
    artist: { mbid: "r1", name: "Radiohead" },
  };
}

const AIRBAG = song("a1", "Airbag");
const LUCKY = song("b2", "Lucky");

function summary(id: number, name: string, overrides: Partial<Playlist> = {}): Playlist {
  return {
    id,
    name,
    description: null,
    is_public: true,
    owner: { username: "alice" },
    song_count: 0,
    updated_at: "2026-10-02T18:30:00+00:00",
    ...overrides,
  };
}

function detail(songs: SongSummary[], overrides: Partial<Playlist> = {}): PlaylistDetail {
  return { ...summary(1, "Late nights", overrides), song_count: songs.length, songs };
}

function songTitles() {
  const list = screen.getByRole("list", { name: "Songs" });
  return within(list)
    .getAllByRole("listitem")
    .map((item) => within(item).getAllByRole("link")[0].textContent);
}

describe("user playlists page", () => {
  it("shows the owner's playlists and creates a new one", async () => {
    mockFetch({
      ...ME_ALICE,
      "GET /api/users/alice/playlists": {
        body: {
          items: [
            summary(1, "Late nights", { song_count: 2 }),
            summary(2, "Drafts", { is_public: false }),
          ],
        },
      },
      "POST /api/playlists": (body) => ({
        status: 201,
        body: summary(3, (body as PlaylistFields).name),
      }),
      "GET /api/playlists/3": { body: { ...detail([]), id: 3, name: "Road trip" } },
    });
    renderAt("/users/alice/playlists");

    expect(await screen.findByRole("link", { name: "Late nights" })).toBeInTheDocument();
    expect(screen.getByText("2 songs")).toBeInTheDocument();
    expect(screen.getByText("Private")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Name"), "Road trip");
    await userEvent.click(screen.getByRole("button", { name: "Create playlist" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Road trip" })).toBeInTheDocument();
  });

  it("shows visitors an empty state and no create form", async () => {
    mockFetch({ ...ME_NOBODY, "GET /api/users/bob/playlists": { body: { items: [] } } });
    renderAt("/users/bob/playlists");

    expect(await screen.findByText("bob has no public playlists")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });
});

describe("playlist page", () => {
  it("moves a song up for the owner", async () => {
    const fetchMock = mockFetch({
      ...ME_ALICE,
      "GET /api/playlists/1": { body: detail([AIRBAG, LUCKY]) },
      "PUT /api/playlists/1/songs": { body: detail([LUCKY, AIRBAG]) },
    });
    renderAt("/playlists/1");

    await userEvent.click(await screen.findByRole("button", { name: "Move Lucky up" }));

    await waitFor(() => expect(songTitles()).toEqual(["Lucky", "Airbag"]));
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ mbids: ["b2", "a1"] });
  });

  it("removes a song for the owner", async () => {
    mockFetch({
      ...ME_ALICE,
      "GET /api/playlists/1": { body: detail([AIRBAG, LUCKY]) },
      "DELETE /api/playlists/1/songs/a1": { body: detail([LUCKY]) },
    });
    renderAt("/playlists/1");

    await userEvent.click(await screen.findByRole("button", { name: "Remove Airbag" }));

    await waitFor(() => expect(songTitles()).toEqual(["Lucky"]));
  });

  it("edits the playlist details", async () => {
    mockFetch({
      ...ME_ALICE,
      "GET /api/playlists/1": { body: detail([AIRBAG]) },
      "PATCH /api/playlists/1": (body) => ({
        body: summary(1, (body as PlaylistFields).name, { song_count: 1 }),
      }),
    });
    renderAt("/playlists/1");

    await userEvent.click(await screen.findByRole("button", { name: "Edit details" }));
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Night drive");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Night drive" }),
    ).toBeInTheDocument();
  });

  it("deletes after an inline confirmation", async () => {
    mockFetch({
      ...ME_ALICE,
      "GET /api/playlists/1": { body: detail([AIRBAG]) },
      "DELETE /api/playlists/1": { status: 204 },
      "GET /api/users/alice/playlists": { body: { items: [] } },
    });
    renderAt("/playlists/1");

    await userEvent.click(await screen.findByRole("button", { name: "Delete playlist" }));
    expect(screen.getByText("Delete playlist?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "alice's playlists" }),
    ).toBeInTheDocument();
  });

  it("shows visitors the songs without owner controls", async () => {
    mockFetch({ ...ME_NOBODY, "GET /api/playlists/1": { body: detail([AIRBAG]) } });
    renderAt("/playlists/1");

    expect(await screen.findByRole("link", { name: "Airbag" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Move Airbag/ })).not.toBeInTheDocument();
  });
});

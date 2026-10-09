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
const CREEP = song("c3", "Creep");

const SERVER_ERROR = {
  status: 500,
  body: { error: { code: "server_error", message: "Server error" } },
};
const NOT_FOUND = {
  status: 404,
  body: { error: { code: "not_found", message: "Playlist not found" } },
};

// holds a mocked reply until the test opens it
function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

const puts = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");

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

describe("user playlists page states", () => {
  it("answers an unknown user with the not found state", async () => {
    mockFetch({
      ...ME_NOBODY,
      "GET /api/users/ghost/playlists": {
        status: 404,
        body: { error: { code: "not_found", message: "User not found" } },
      },
    });
    renderAt("/users/ghost/playlists");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("shows the skeleton instead of the visitor view while the session loads", async () => {
    const session = gate();
    mockFetch({
      "GET /api/auth/me": async () => {
        await session.opened;
        return { body: { user: ALICE } };
      },
      "GET /api/users/alice/playlists": { body: { items: [summary(1, "Late nights")] } },
    });
    const { queryClient } = renderAt("/users/alice/playlists");

    await waitFor(() => expect(queryClient.getQueryData(["playlists", "alice"])).toBeDefined());
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Late nights" })).not.toBeInTheDocument();
    session.open();

    expect(await screen.findByRole("link", { name: "Late nights" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create playlist" })).toBeInTheDocument();
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

  it("shows visitors the not found state for a private playlist", async () => {
    mockFetch({ ...ME_NOBODY, "GET /api/playlists/1": NOT_FOUND });
    renderAt("/playlists/1");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("Page not found | TrackmyTracks");
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("shows the skeleton instead of the visitor view while the session loads", async () => {
    const session = gate();
    mockFetch({
      "GET /api/auth/me": async () => {
        await session.opened;
        return { body: { user: ALICE } };
      },
      "GET /api/playlists/1": { body: detail([AIRBAG]) },
    });
    const { queryClient } = renderAt("/playlists/1");

    await waitFor(() => expect(queryClient.getQueryData(["playlist", 1])).toBeDefined());
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Airbag" })).not.toBeInTheDocument();
    session.open();

    expect(await screen.findByRole("button", { name: "Edit details" })).toBeInTheDocument();
  });

  it("titles the song list for screen readers", async () => {
    mockFetch({ ...ME_NOBODY, "GET /api/playlists/1": { body: detail([AIRBAG]) } });
    renderAt("/playlists/1");

    expect(await screen.findByRole("heading", { level: 2, name: "Songs" })).toHaveClass(
      "visually-hidden",
    );
  });

  it("invites the owner to fill an empty playlist", async () => {
    mockFetch({ ...ME_ALICE, "GET /api/playlists/1": { body: detail([]) } });
    renderAt("/playlists/1");

    expect(await screen.findByText("No songs yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find songs" })).toHaveAttribute("href", "/search");
  });
});

describe("playlist reordering", () => {
  function reorderable() {
    let order = [AIRBAG, LUCKY, CREEP];
    return mockFetch({
      ...ME_ALICE,
      "GET /api/playlists/1": () => ({ body: detail(order) }),
      "PUT /api/playlists/1/songs": (body) => {
        const { mbids } = body as { mbids: string[] };
        order = mbids.map((mbid) => order.find((item) => item.mbid === mbid) as SongSummary);
        return { body: detail(order) };
      },
    });
  }

  it("keeps focus on the row's button across two keyboard moves", async () => {
    const fetchMock = reorderable();
    renderAt("/playlists/1");

    const creepUp = await screen.findByRole("button", { name: "Move Creep up" });
    creepUp.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(songTitles()).toEqual(["Airbag", "Creep", "Lucky"]));
    await waitFor(() => expect(screen.getByRole("button", { name: "Move Creep up" })).toHaveFocus());
    expect(screen.getByRole("status")).toHaveTextContent("Creep moved to position 2");

    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(songTitles()).toEqual(["Creep", "Airbag", "Lucky"]));
    expect(puts(fetchMock)).toHaveLength(2);
    // the row reached the top, so focus moves to its Down button
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Move Creep down" })).toHaveFocus(),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Creep moved to position 1");
  });

  it("moves a song down and hands focus to Up at the bottom edge", async () => {
    reorderable();
    renderAt("/playlists/1");

    await userEvent.click(await screen.findByRole("button", { name: "Move Lucky down" }));

    await waitFor(() => expect(songTitles()).toEqual(["Airbag", "Creep", "Lucky"]));
    await waitFor(() => expect(screen.getByRole("button", { name: "Move Lucky up" })).toHaveFocus());
  });

  it("keeps the first Up and last Down unavailable", async () => {
    reorderable();
    renderAt("/playlists/1");

    expect(await screen.findByRole("button", { name: "Move Airbag up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Creep down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Lucky up" })).toBeEnabled();
  });

  it("ignores moves while a removal is pending", async () => {
    const removal = gate();
    const fetchMock = mockFetch({
      ...ME_ALICE,
      "GET /api/playlists/1": { body: detail([AIRBAG, LUCKY]) },
      "DELETE /api/playlists/1/songs/a1": async () => {
        await removal.opened;
        return { body: detail([LUCKY]) };
      },
    });
    renderAt("/playlists/1");

    await userEvent.click(await screen.findByRole("button", { name: "Remove Airbag" }));
    const luckyUp = screen.getByRole("button", { name: "Move Lucky up" });
    expect(luckyUp).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(luckyUp);
    expect(puts(fetchMock)).toHaveLength(0);

    removal.open();
    await waitFor(() => expect(songTitles()).toEqual(["Lucky"]));
  });

  it("shows only the latest song failure with a specific title", async () => {
    mockFetch({
      ...ME_ALICE,
      "GET /api/playlists/1": { body: detail([AIRBAG, LUCKY]) },
      "PUT /api/playlists/1/songs": SERVER_ERROR,
      "DELETE /api/playlists/1/songs/a1": SERVER_ERROR,
    });
    renderAt("/playlists/1");

    await userEvent.click(await screen.findByRole("button", { name: "Move Lucky up" }));
    expect(await screen.findByText("Could not reorder")).toBeInTheDocument();
    expect(songTitles()).toEqual(["Airbag", "Lucky"]);

    await userEvent.click(screen.getByRole("button", { name: "Remove Airbag" }));
    expect(await screen.findByText("Could not remove")).toBeInTheDocument();
    expect(screen.queryByText("Could not reorder")).not.toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});

describe("playlist panels", () => {
  it("moves focus into the edit panel and back to its button", async () => {
    mockFetch({ ...ME_ALICE, "GET /api/playlists/1": { body: detail([AIRBAG]) } });
    renderAt("/playlists/1");

    const edit = await screen.findByRole("button", { name: "Edit details" });
    expect(edit).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(edit);
    expect(edit).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Name")).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(edit).toHaveFocus();
    expect(edit).toHaveAttribute("aria-expanded", "false");
  });

  it("returns focus to the edit button after saving", async () => {
    mockFetch({
      ...ME_ALICE,
      "GET /api/playlists/1": { body: detail([AIRBAG]) },
      "PATCH /api/playlists/1": (body) => ({ body: summary(1, (body as PlaylistFields).name) }),
    });
    renderAt("/playlists/1");

    await userEvent.click(await screen.findByRole("button", { name: "Edit details" }));
    await userEvent.type(screen.getByLabelText("Name"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.queryByLabelText("Name")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Edit details" })).toHaveFocus();
  });

  it("moves focus to the delete confirmation and back on cancel", async () => {
    mockFetch({ ...ME_ALICE, "GET /api/playlists/1": { body: detail([AIRBAG]) } });
    renderAt("/playlists/1");

    const open = await screen.findByRole("button", { name: "Delete playlist" });
    await userEvent.click(open);
    expect(screen.getByRole("heading", { level: 2, name: "Delete playlist?" })).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(open).toHaveFocus();
  });

  it("locks the page actions while a delete is pending", async () => {
    const removal = gate();
    mockFetch({
      ...ME_ALICE,
      "GET /api/playlists/1": { body: detail([AIRBAG]) },
      "DELETE /api/playlists/1": async () => {
        await removal.opened;
        return { status: 204 };
      },
      "GET /api/users/alice/playlists": { body: { items: [] } },
    });
    renderAt("/playlists/1");

    await userEvent.click(await screen.findByRole("button", { name: "Delete playlist" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit details" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete playlist" })).toBeDisabled();
    removal.open();
    expect(
      await screen.findByRole("heading", { level: 1, name: "alice's playlists" }),
    ).toBeInTheDocument();
  });

  it("reports a failed delete and keeps the playlist", async () => {
    mockFetch({
      ...ME_ALICE,
      "GET /api/playlists/1": { body: detail([AIRBAG]) },
      "DELETE /api/playlists/1": SERVER_ERROR,
    });
    renderAt("/playlists/1");

    await userEvent.click(await screen.findByRole("button", { name: "Delete playlist" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Server error");
    expect(screen.getByRole("heading", { level: 1, name: "Late nights" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });
});

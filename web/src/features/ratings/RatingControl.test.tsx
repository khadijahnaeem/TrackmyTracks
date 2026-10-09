import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { RatingSummary } from "../../api/types";
import { mockFetch } from "../../test/fetch";
import { renderWithProviders } from "../../test/render";
import { RatingControl } from "./RatingControl";

const SONG = "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3";
const ALBUM = "b1392450-e666-3926-a536-22c65f834433";
const ME = {
  "GET /api/auth/me": { body: { user: { id: 1, username: "alice", email: "alice@example.com" } } },
};
const UNRATED: RatingSummary = { mine: null, community: { stars: null, count: 0 } };
const RATED: RatingSummary = {
  mine: { stars: 3, is_derived: false, song_count: 0, review: null },
  community: { stars: 3.7, count: 12 },
};
const DERIVED: RatingSummary = {
  mine: { stars: 3.7, is_derived: true, song_count: 3, review: null },
  community: { stars: 3.7, count: 1 },
};
const DERIVED_TEXT = "3.7, average of your 3 song ratings. Rate to set your own.";

function failure(message: string) {
  return { status: 500, body: { error: { code: "internal_server_error", message } } };
}

function ratedWith(stars: number): RatingSummary {
  return { ...RATED, mine: { stars, is_derived: false, song_count: 0, review: null } };
}

async function pressKey(key: string) {
  const slider = await screen.findByRole("slider", { name: "Your rating" });
  slider.focus();
  await userEvent.keyboard(key);
  return slider;
}

function putStars(fetchMock: ReturnType<typeof mockFetch>) {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([, init]) => JSON.parse(String(init?.body)).stars);
}

describe("RatingControl", () => {
  it("saves a rating optimistically", async () => {
    const fetchMock = mockFetch({ ...ME, "PUT /api/ratings": { body: { mbid: SONG, rating: ratedWith(5) } } });
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={UNRATED} />);

    const slider = await pressKey("{End}");

    expect(slider).toHaveAttribute("aria-valuenow", "5");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/ratings");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ kind: "song", mbid: SONG, stars: 5 });
  });

  it("rolls back and explains a failed save", async () => {
    mockFetch({ ...ME, "PUT /api/ratings": failure("Could not save") });
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={RATED} />);

    const slider = await pressKey("{End}");

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
    expect(slider).toHaveAttribute("aria-valuenow", "3");
  });

  it("shows the community line and clears an explicit rating", async () => {
    const fetchMock = mockFetch({
      ...ME,
      [`DELETE /api/ratings/song/${SONG}`]: { body: { mbid: SONG, rating: UNRATED } },
    });
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={RATED} />);

    expect(screen.getByText("3.7 from 12 ratings")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Clear your rating" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/ratings/song/${SONG}`,
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("explains a derived album rating", async () => {
    mockFetch(ME);
    renderWithProviders(<RatingControl kind="album" mbid={ALBUM} rating={DERIVED} />);

    const slider = await screen.findByRole("slider", { name: "Your rating" });
    expect(slider).toHaveAccessibleDescription(DERIVED_TEXT);
    expect(screen.queryByRole("button", { name: "Clear your rating" })).not.toBeInTheDocument();
  });

  it("asks logged out visitors to log in", async () => {
    mockFetch({ "GET /api/auth/me": { body: { user: null } } });
    renderWithProviders(<RatingControl kind="album" mbid={ALBUM} rating={UNRATED} />, {
      path: "/albums/ok?tab=reviews",
    });

    expect(await screen.findByRole("link", { name: "Log in to rate" })).toHaveAttribute(
      "href",
      "/login?next=%2Falbums%2Fok%3Ftab%3Dreviews",
    );
    expect(screen.getByText("No ratings yet")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("renders no rating block while the session loads", async () => {
    mockFetch(ME);
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={UNRATED} />);

    expect(screen.queryByRole("link", { name: "Log in to rate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(await screen.findByRole("slider", { name: "Your rating" })).toBeInTheDocument();
  });

  it("needs stars before a review can be saved", async () => {
    mockFetch(ME);
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={UNRATED} />);

    await userEvent.click(await screen.findByRole("button", { name: "Write a review" }));

    const save = screen.getByRole("button", { name: "Save review" });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription("Pick a star rating first");
  });

  it("saves a review with the current stars and closes the form", async () => {
    const fetchMock = mockFetch({ ...ME, "PUT /api/ratings": { body: { mbid: SONG, rating: RATED } } });
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={RATED} />);

    await userEvent.click(await screen.findByRole("button", { name: "Write a review" }));
    await userEvent.type(screen.getByLabelText("Your review"), "Still great");
    await userEvent.click(screen.getByRole("button", { name: "Save review" }));

    const opener = await screen.findByRole("button", { name: "Write a review" });
    await waitFor(() => expect(opener).toHaveFocus());
    const [, init] = fetchMock.mock.calls[1];
    expect(JSON.parse(String(init?.body))).toEqual({
      kind: "song",
      mbid: SONG,
      stars: 3,
      review: "Still great",
    });
  });

  it("focuses the review field on open and returns focus to the opener on cancel", async () => {
    mockFetch(ME);
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={RATED} />);

    await userEvent.click(await screen.findByRole("button", { name: "Write a review" }));
    expect(screen.getByLabelText("Your review")).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Write a review" })).toHaveFocus();
  });

  it("labels compact controls by title", async () => {
    mockFetch(ME);
    renderWithProviders(
      <RatingControl kind="song" mbid={SONG} rating={RATED} title="Airbag" compact />,
    );

    expect(await screen.findByRole("slider", { name: "Your rating for Airbag" })).toHaveAttribute(
      "aria-valuenow",
      "3",
    );
    expect(screen.queryByRole("button", { name: "Write a review" })).not.toBeInTheDocument();
  });

  it("steps a derived rating up from the nearest half star", async () => {
    const fetchMock = mockFetch({ ...ME, "PUT /api/ratings": { body: { mbid: ALBUM, rating: RATED } } });
    renderWithProviders(<RatingControl kind="album" mbid={ALBUM} rating={DERIVED} />);

    await pressKey("{ArrowRight}");

    await waitFor(() => expect(putStars(fetchMock)).toEqual([4]));
  });

  it("steps a derived rating down to the half star below", async () => {
    const fetchMock = mockFetch({ ...ME, "PUT /api/ratings": { body: { mbid: ALBUM, rating: RATED } } });
    renderWithProviders(<RatingControl kind="album" mbid={ALBUM} rating={DERIVED} />);

    await pressKey("{ArrowLeft}");

    await waitFor(() => expect(putStars(fetchMock)).toEqual([3.5]));
  });

  it("sends rapid ratings one at a time and keeps the latest choice", async () => {
    let releaseFirst = () => {};
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let calls = 0;
    const fetchMock = mockFetch({
      ...ME,
      "PUT /api/ratings": async (body) => {
        calls += 1;
        if (calls === 1) await firstGate;
        const { stars } = body as { stars: number };
        return { body: { mbid: SONG, rating: ratedWith(stars) } };
      },
    });
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={UNRATED} />);

    const slider = await pressKey("{End}");
    await userEvent.keyboard("{Home}");

    expect(slider).toHaveAttribute("aria-valuenow", "0.5");
    expect(putStars(fetchMock)).toEqual([5]);
    releaseFirst();
    await waitFor(() => expect(putStars(fetchMock)).toEqual([5, 0.5]));
    expect(slider).toHaveAttribute("aria-valuenow", "0.5");
  });

  it("shows the derived average from the clear response", async () => {
    mockFetch({
      ...ME,
      [`DELETE /api/ratings/album/${ALBUM}`]: { body: { mbid: ALBUM, rating: DERIVED } },
    });
    renderWithProviders(<RatingControl kind="album" mbid={ALBUM} rating={RATED} />);

    await userEvent.click(await screen.findByRole("button", { name: "Clear your rating" }));

    expect(await screen.findByText(DERIVED_TEXT)).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Your rating" })).toHaveAttribute("aria-valuenow", "3.7");
    expect(screen.queryByRole("button", { name: "Clear your rating" })).not.toBeInTheDocument();
  });

  it("words the clear button for a saved review", async () => {
    mockFetch(ME);
    const reviewed: RatingSummary = { ...RATED, mine: { ...RATED.mine!, review: "Great" } };
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={reviewed} />);

    const clear = await screen.findByRole("button", { name: "Clear your rating" });
    expect(clear).toHaveTextContent("Clear rating and review");
  });

  it("drops a stale clear error once a save is attempted", async () => {
    mockFetch({
      ...ME,
      [`DELETE /api/ratings/song/${SONG}`]: failure("Could not clear"),
      "PUT /api/ratings": { body: { mbid: SONG, rating: RATED } },
    });
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={RATED} />);

    await userEvent.click(await screen.findByRole("button", { name: "Clear your rating" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not clear");
    await pressKey("{End}");

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("drops a stale save error once a clear is attempted", async () => {
    mockFetch({
      ...ME,
      "PUT /api/ratings": failure("Could not save"),
      [`DELETE /api/ratings/song/${SONG}`]: { body: { mbid: SONG, rating: UNRATED } },
    });
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={RATED} />);

    await pressKey("{End}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
    await userEvent.click(screen.getByRole("button", { name: "Clear your rating" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});

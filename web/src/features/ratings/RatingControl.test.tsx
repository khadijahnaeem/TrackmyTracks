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

async function pressEnd(name = "Your rating") {
  const slider = await screen.findByRole("slider", { name });
  slider.focus();
  await userEvent.keyboard("{End}");
  return slider;
}

describe("RatingControl", () => {
  it("saves a rating optimistically", async () => {
    const fetchMock = mockFetch({ ...ME, "PUT /api/ratings": { body: { mbid: SONG, rating: RATED } } });
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={UNRATED} />);

    const slider = await pressEnd();

    expect(slider).toHaveAttribute("aria-valuenow", "5");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/ratings");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ kind: "song", mbid: SONG, stars: 5 });
  });

  it("rolls back and explains a failed save", async () => {
    mockFetch({
      ...ME,
      "PUT /api/ratings": {
        status: 500,
        body: { error: { code: "internal_server_error", message: "Could not save" } },
      },
    });
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={RATED} />);

    const slider = await pressEnd();

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
    await userEvent.click(await screen.findByRole("button", { name: "Clear" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/ratings/song/${SONG}`,
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("explains a derived album rating", async () => {
    mockFetch(ME);
    const derived: RatingSummary = {
      mine: { stars: 3.7, is_derived: true, song_count: 3, review: null },
      community: { stars: 3.7, count: 1 },
    };
    renderWithProviders(<RatingControl kind="album" mbid={ALBUM} rating={derived} />);

    expect(
      await screen.findByText("3.7, average of your 3 song ratings. Rate to set your own."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
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

  it("needs stars before a review can be saved", async () => {
    mockFetch(ME);
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={UNRATED} />);

    await userEvent.click(await screen.findByRole("button", { name: "Write a review" }));

    expect(screen.getByRole("button", { name: "Save review" })).toBeDisabled();
    expect(screen.getByText("Pick a star rating first")).toBeInTheDocument();
  });

  it("saves a review with the current stars and closes the form", async () => {
    const fetchMock = mockFetch({ ...ME, "PUT /api/ratings": { body: { mbid: SONG, rating: RATED } } });
    renderWithProviders(<RatingControl kind="song" mbid={SONG} rating={RATED} />);

    await userEvent.click(await screen.findByRole("button", { name: "Write a review" }));
    await userEvent.type(screen.getByLabelText("Your review"), "Still great");
    await userEvent.click(screen.getByRole("button", { name: "Save review" }));

    expect(await screen.findByRole("button", { name: "Write a review" })).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[1];
    expect(JSON.parse(String(init?.body))).toEqual({
      kind: "song",
      mbid: SONG,
      stars: 3,
      review: "Still great",
    });
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
});

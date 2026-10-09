import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockFetch } from "../../test/fetch";
import { renderWithProviders } from "../../test/render";
import { ReviewList } from "./ReviewList";

const SONG = "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3";
const FIRST_PAGE = `GET /api/songs/${SONG}/reviews?page=1`;

describe("ReviewList", () => {
  it("lists reviews with author, stars, and date", async () => {
    mockFetch({
      [FIRST_PAGE]: {
        body: {
          items: [
            {
              id: 1,
              user: { username: "bob" },
              stars: 4.5,
              review: "Instant classic",
              updated_at: "2026-10-02T18:30:00+00:00",
            },
          ],
          page: 1,
          pages: 1,
          total: 1,
        },
      },
    });
    renderWithProviders(<ReviewList kind="song" mbid={SONG} />);

    expect(await screen.findByText("Instant classic")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "bob" })).toHaveAttribute("href", "/users/bob/history");
    expect(screen.getByRole("img", { name: "bob's rating: 4.5 out of 5" })).toBeInTheDocument();
    expect(screen.getByText("Oct 2, 2026")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    mockFetch({ [FIRST_PAGE]: { body: { items: [], page: 1, pages: 0, total: 0 } } });
    renderWithProviders(<ReviewList kind="song" mbid={SONG} />);

    expect(await screen.findByText("No reviews yet")).toBeInTheDocument();
  });

  it("offers a retry when loading fails", async () => {
    const fetchMock = mockFetch({
      [FIRST_PAGE]: {
        status: 502,
        body: { error: { code: "catalog_unavailable", message: "Music catalog is unavailable, try again" } },
      },
    });
    renderWithProviders(<ReviewList kind="song" mbid={SONG} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Music catalog is unavailable");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

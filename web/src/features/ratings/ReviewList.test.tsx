import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { mockFetch } from "../../test/fetch";
import { renderWithProviders } from "../../test/render";
import { ReviewList } from "./ReviewList";

const SONG = "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3";
const OTHER = "b1392450-e666-3926-a536-22c65f834433";
const FIRST_PAGE = `GET /api/songs/${SONG}/reviews?page=1`;
const SECOND_PAGE = `GET /api/songs/${SONG}/reviews?page=2`;

function reviewPage(page: number, text: string) {
  const review = { id: page, user: { username: "bob" }, stars: 4, review: text, updated_at: "2026-10-02T18:30:00+00:00" };
  return { body: { items: [review], page, pages: 2, total: 2 } };
}

function Switcher() {
  const [mbid, setMbid] = useState(SONG);
  return (
    <>
      <button type="button" onClick={() => setMbid(OTHER)}>
        Switch
      </button>
      <ReviewList kind="song" mbid={mbid} />
    </>
  );
}

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

  it("dims the list and locks paging while the next page loads", async () => {
    let releaseSecond = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const fetchMock = mockFetch({
      [FIRST_PAGE]: reviewPage(1, "First page"),
      [SECOND_PAGE]: async () => {
        await gate;
        return reviewPage(2, "Second page");
      },
    });
    renderWithProviders(<ReviewList kind="song" mbid={SONG} />);

    await screen.findByText("First page");
    expect(screen.getByRole("list")).not.toHaveAttribute("aria-busy");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(fetchMock).toHaveBeenCalledWith(`/api/songs/${SONG}/reviews?page=2`, expect.anything());
    expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    releaseSecond();
    expect(await screen.findByText("Second page")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("list")).not.toHaveAttribute("aria-busy"));
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  it("returns to page 1 when the item changes", async () => {
    const fetchMock = mockFetch({
      [FIRST_PAGE]: reviewPage(1, "First page"),
      [SECOND_PAGE]: reviewPage(2, "Second page"),
      [`GET /api/songs/${OTHER}/reviews?page=1`]: reviewPage(1, "Other item"),
    });
    renderWithProviders(<Switcher />);

    await screen.findByText("First page");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Second page");
    await userEvent.click(screen.getByRole("button", { name: "Switch" }));

    expect(await screen.findByText("Other item")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(`/api/songs/${OTHER}/reviews?page=1`, expect.anything());
  });
});

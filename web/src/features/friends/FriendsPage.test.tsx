import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Friends } from "../../api/types";
import { mockFetch } from "../../test/fetch";
import { renderAt } from "../../test/render";

const ME = { user: { id: 1, username: "alex", email: "alex@example.com" } };
const SINCE = "2026-10-02T18:30:00+00:00";

const FULL: Friends = {
  friends: [{ user: { username: "sam" }, since: SINCE }],
  incoming: [{ user: { username: "maya" }, sent_at: SINCE }],
  outgoing: [{ user: { username: "jordyn_b" }, sent_at: SINCE }],
};

describe("FriendsPage", () => {
  it("redirects guests to log in", async () => {
    mockFetch({ "GET /api/auth/me": { body: { user: null } } });
    const { router } = renderAt("/friends");

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.search).toBe("?next=%2Ffriends");
  });

  it("lists requests, sent, and friends", async () => {
    mockFetch({ "GET /api/auth/me": { body: ME }, "GET /api/friends": { body: FULL } });
    renderAt("/friends");

    expect(await screen.findByRole("heading", { name: "Requests" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sent" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your friends" })).toBeInTheDocument();
    expect(screen.getByText("maya")).toBeInTheDocument();
    expect(screen.getByText("jordyn_b")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "sam" })).toHaveAttribute("href", "/users/sam/history");
    expect(screen.getByRole("link", { name: "sam's history" })).toHaveAttribute("href", "/users/sam/history");
  });

  it("accepts and declines", async () => {
    const fetchMock = mockFetch({
      "GET /api/auth/me": { body: ME },
      "GET /api/friends": { body: FULL },
      "POST /api/friends/requests/maya/accept": { body: { status: "friends" } },
      "DELETE /api/friends/maya": { status: 204 },
    });
    renderAt("/friends");

    await userEvent.click(await screen.findByRole("button", { name: "Accept maya" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/friends/requests/maya/accept", expect.anything()),
    );
    await userEvent.click(screen.getByRole("button", { name: "Decline maya" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/friends/maya",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("disables a row's buttons while its request is pending", async () => {
    let finish: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    mockFetch({
      "GET /api/auth/me": { body: ME },
      "GET /api/friends": { body: FULL },
      "POST /api/friends/requests/maya/accept": async () => {
        await gate;
        return { body: { status: "friends" } };
      },
    });
    renderAt("/friends");

    await userEvent.click(await screen.findByRole("button", { name: "Accept maya" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Accept maya" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Decline maya" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Unfriend sam" })).toBeEnabled();
    finish();
    await waitFor(() => expect(screen.getByRole("button", { name: "Decline maya" })).toBeEnabled());
  });

  it("cancels and unfriends", async () => {
    const fetchMock = mockFetch({
      "GET /api/auth/me": { body: ME },
      "GET /api/friends": { body: FULL },
      "DELETE /api/friends/jordyn_b": { status: 204 },
      "DELETE /api/friends/sam": { status: 204 },
    });
    renderAt("/friends");

    await userEvent.click(await screen.findByRole("button", { name: "Cancel request to jordyn_b" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/friends/jordyn_b",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Unfriend sam" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/friends/sam",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("searches people", async () => {
    const fetchMock = mockFetch({
      "GET /api/auth/me": { body: ME },
      "GET /api/friends": { body: { friends: [], incoming: [], outgoing: [] } },
      "GET /api/users?q=jor": { body: { items: [{ username: "jordan" }] } },
    });
    renderAt("/friends");

    await userEvent.type(await screen.findByRole("textbox", { name: "Find people" }), "jor{Enter}");

    const search = screen.getByRole("search");
    expect(
      await within(search.parentElement as HTMLElement).findByRole("button", { name: "Add jordan as a friend" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/users?q=jor", expect.anything());
  });

  it("shows empty lines", async () => {
    mockFetch({
      "GET /api/auth/me": { body: ME },
      "GET /api/friends": { body: { friends: [], incoming: [], outgoing: [] } },
    });
    renderAt("/friends");

    expect(await screen.findByText("No requests right now")).toBeInTheDocument();
    expect(screen.getByText("You haven't added anyone yet")).toBeInTheDocument();
  });
});

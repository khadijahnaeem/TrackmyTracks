import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Friends } from "../../api/types";
import { mockFetch } from "../../test/fetch";
import { renderWithProviders } from "../../test/render";
import { FriendButton } from "./FriendButton";

const ME = { user: { id: 1, username: "alex", email: "alex@example.com" } };
const SINCE = "2026-10-02T18:30:00+00:00";

function friends(overrides: Partial<Friends> = {}): Friends {
  return { friends: [], incoming: [], outgoing: [], ...overrides };
}

describe("FriendButton", () => {
  it("offers Add friend and sends the request", async () => {
    let current = friends();
    const fetchMock = mockFetch({
      "GET /api/auth/me": { body: ME },
      "GET /api/friends": () => ({ body: current }),
      "POST /api/friends/requests": (body) => {
        expect(body).toEqual({ username: "sam" });
        current = friends({ outgoing: [{ user: { username: "sam" }, sent_at: SINCE }] });
        return { status: 201, body: { status: "sent" } };
      },
    });
    renderWithProviders(<FriendButton username="sam" />);

    await userEvent.click(await screen.findByRole("button", { name: "Add sam as a friend" }));

    expect(await screen.findByText("Request sent")).toBeInTheDocument();
    const friendLoads = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/friends");
    expect(friendLoads).toHaveLength(2);
  });

  it("shows Request sent for outgoing", async () => {
    mockFetch({
      "GET /api/auth/me": { body: ME },
      "GET /api/friends": { body: friends({ outgoing: [{ user: { username: "sam" }, sent_at: SINCE }] }) },
    });
    renderWithProviders(<FriendButton username="sam" />);

    expect(await screen.findByText("Request sent")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers Accept for incoming", async () => {
    let current = friends({ incoming: [{ user: { username: "sam" }, sent_at: SINCE }] });
    mockFetch({
      "GET /api/auth/me": { body: ME },
      "GET /api/friends": () => ({ body: current }),
      "POST /api/friends/requests/sam/accept": () => {
        current = friends({ friends: [{ user: { username: "sam" }, since: SINCE }] });
        return { body: { status: "friends" } };
      },
    });
    renderWithProviders(<FriendButton username="sam" />);

    await userEvent.click(await screen.findByRole("button", { name: "Accept sam's request" }));

    expect(await screen.findByText("Friends")).toBeInTheDocument();
  });

  it("shows Friends for a friend", async () => {
    mockFetch({
      "GET /api/auth/me": { body: ME },
      "GET /api/friends": { body: friends({ friends: [{ user: { username: "sam" }, since: SINCE }] }) },
    });
    renderWithProviders(<FriendButton username="sam" />);

    expect(await screen.findByText("Friends")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing for yourself", async () => {
    const fetchMock = mockFetch({
      "GET /api/auth/me": { body: ME },
      "GET /api/friends": { body: friends() },
    });
    const { container } = renderWithProviders(<FriendButton username="alex" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/friends", expect.anything()));
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing and fetches nothing logged out", async () => {
    const fetchMock = mockFetch({ "GET /api/auth/me": { body: { user: null } } });
    const { container } = renderWithProviders(<FriendButton username="sam" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(["/api/auth/me"]);
  });
});

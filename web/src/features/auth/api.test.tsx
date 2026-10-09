import { useMutation } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { api } from "../../api/client";
import { mockFetch } from "../../test/fetch";
import { renderWithProviders } from "../../test/render";
import { useLogout } from "./api";
import { useUnauthorizedRedirect } from "./useUnauthorizedRedirect";

const UNAUTHORIZED = {
  status: 401,
  body: { error: { code: "unauthorized", message: "Log in to continue" } },
};

function SaveHarness({ expectsUnauthorized = false }: { expectsUnauthorized?: boolean }) {
  useUnauthorizedRedirect();
  const save = useMutation({
    mutationFn: () => api.post("/playlists"),
    meta: { expectsUnauthorized },
  });
  return <button onClick={() => save.mutate()}>Save</button>;
}

function LogoutHarness() {
  const logout = useLogout();
  return <button onClick={() => logout.mutate()}>Log out</button>;
}

describe("auth data layer", () => {
  it("sends a 401 write to login and back", async () => {
    mockFetch({ "POST /api/playlists": UNAUTHORIZED });
    const { router, queryClient } = renderWithProviders(<SaveHarness />, {
      path: "/playlists/1?tab=songs",
    });

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.search).toBe("?next=%2Fplaylists%2F1%3Ftab%3Dsongs");
    expect(queryClient.getQueryData(["me"])).toEqual({ user: null });
  });

  it("leaves expected 401s to the form", async () => {
    const fetchMock = mockFetch({ "POST /api/playlists": UNAUTHORIZED });
    const { router } = renderWithProviders(<SaveHarness expectsUnauthorized />, {
      path: "/login",
    });

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(router.state.location.search).toBe("");
  });

  it("clears user data on logout", async () => {
    mockFetch({ "POST /api/auth/logout": { status: 204 } });
    const { queryClient } = renderWithProviders(<LogoutHarness />);
    queryClient.setQueryData(["me"], { user: { id: 1, username: "alice", email: "a@b.co" } });
    queryClient.setQueryData(["playlists", "alice"], { items: [] });

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(queryClient.getQueryData(["me"])).toEqual({ user: null }));
    expect(queryClient.getQueryData(["playlists", "alice"])).toBeUndefined();
  });
});

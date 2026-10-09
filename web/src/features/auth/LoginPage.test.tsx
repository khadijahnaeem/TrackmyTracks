import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockFetch } from "../../test/fetch";
import { renderAt } from "../../test/render";

const ALICE = { id: 1, username: "alice", email: "alice@example.com" };

async function submitLogin() {
  await userEvent.type(await screen.findByLabelText("Email"), "alice@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "password123");
  await userEvent.click(screen.getByRole("button", { name: "Log in" }));
}

describe("LoginPage", () => {
  it("logs in and returns to the next page", async () => {
    mockFetch({
      "GET /api/auth/me": { body: { user: null } },
      "POST /api/auth/login": { body: { user: ALICE } },
    });
    const { router } = renderAt("/login?next=/somewhere");

    await submitLogin();

    await waitFor(() => expect(router.state.location.pathname).toBe("/somewhere"));
  });

  it("ignores a next that leaves the site", async () => {
    mockFetch({
      "GET /api/auth/me": { body: { user: null } },
      "POST /api/auth/login": { body: { user: ALICE } },
    });
    const { router } = renderAt("/login?next=//evil.com");

    await submitLogin();

    await waitFor(() => expect(router.state.location.pathname).toBe("/search"));
  });

  it("shows the server error and stays on the page", async () => {
    mockFetch({
      "GET /api/auth/me": { body: { user: null } },
      "POST /api/auth/login": {
        status: 401,
        body: { error: { code: "unauthorized", message: "Email or password is incorrect" } },
      },
    });
    const { router } = renderAt("/login");

    await submitLogin();

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect");
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toBe("");
  });
});

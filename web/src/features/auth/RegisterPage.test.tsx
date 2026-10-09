import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockFetch } from "../../test/fetch";
import { renderAt } from "../../test/render";

async function submitRegistration() {
  await userEvent.type(await screen.findByLabelText("Email"), "alice@example.com");
  await userEvent.type(screen.getByLabelText("Username"), "alice");
  await userEvent.type(screen.getByLabelText("Password"), "password123");
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("RegisterPage", () => {
  it("creates the account and lands on search", async () => {
    const fetchMock = mockFetch({
      "GET /api/auth/me": { body: { user: null } },
      "POST /api/auth/register": (body) => ({
        status: 201,
        body: { user: { id: 1, ...(body as { email: string; username: string }) } },
      }),
    });
    const { router } = renderAt("/register");

    await submitRegistration();

    await waitFor(() => expect(router.state.location.pathname).toBe("/search"));
    const [, init] = fetchMock.mock.calls.find(([url]) => url === "/api/auth/register")!;
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "alice@example.com",
      username: "alice",
      password: "password123",
    });
  });

  it("shows a taken username", async () => {
    mockFetch({
      "GET /api/auth/me": { body: { user: null } },
      "POST /api/auth/register": {
        status: 409,
        body: { error: { code: "conflict", message: "Username is taken" } },
      },
    });
    renderAt("/register");

    await submitRegistration();

    expect(await screen.findByRole("alert")).toHaveTextContent("Username is taken");
  });
});

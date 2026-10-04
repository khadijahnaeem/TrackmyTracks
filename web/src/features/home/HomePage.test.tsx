import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { mockFetch } from "../../test/fetch";
import { renderAt } from "../../test/render";

const searchParam = (search: string) => new URLSearchParams(search).get("q");

describe("HomePage", () => {
  beforeEach(() => {
    mockFetch({ "GET /api/auth/me": { body: { user: null } } });
  });

  it("renders the home page at the root", async () => {
    renderAt("/");

    expect(await screen.findByRole("heading", { level: 1, name: "TrackmyTracks" })).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(document.title).toBe("TrackmyTracks");
  });

  it("searches from the hero", async () => {
    const { router } = renderAt("/");

    await userEvent.type(await screen.findByLabelText("Search music"), "AC/DC & co");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(router.state.location.pathname).toBe("/search");
    expect(searchParam(router.state.location.search)).toBe("AC/DC & co");
  });

  it("submits with the enter key", async () => {
    const { router } = renderAt("/");

    await userEvent.type(await screen.findByLabelText("Search music"), "radiohead{Enter}");

    expect(searchParam(router.state.location.search)).toBe("radiohead");
  });

  it("ignores a blank search", async () => {
    const { router } = renderAt("/");

    await userEvent.type(await screen.findByLabelText("Search music"), "   {Enter}");

    expect(router.state.location.pathname).toBe("/");
  });

  it("restores the tab title after another page", async () => {
    const { router } = renderAt("/no-such-page");
    await screen.findByRole("heading", { name: "Page not found" });

    await router.navigate("/");

    expect(await screen.findByRole("heading", { level: 1, name: "TrackmyTracks" })).toBeInTheDocument();
    expect(document.title).toBe("TrackmyTracks");
  });
});

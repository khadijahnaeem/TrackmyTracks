import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { Button } from "./Button";
import { ErrorNotice } from "./Notice";
import { NotFoundState } from "./NotFoundState";
import { PageHeader } from "./PageHeader";
import { Pagination } from "./Pagination";
import { SegmentedControl } from "./SegmentedControl";
import { TextArea } from "./TextArea";
import { TextField } from "./TextField";

describe("ui components", () => {
  it("disables a loading button and announces progress", () => {
    render(<Button loading>Save</Button>);

    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("links a text field label and error", () => {
    render(<TextField label="Email" error="Email is required" />);

    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Email is required");
    expect(screen.getByLabelText("Email")).toBeInvalid();
  });

  it("counts characters in a text area", () => {
    render(<TextArea label="Review" value="Great record" maxLength={2000} onChange={() => {}} />);

    expect(screen.getByText("12 / 2000")).toBeInTheDocument();
  });

  it("shows the api error message", () => {
    const error = new ApiError(502, "catalog_unavailable", "Music catalog is unavailable, try again");
    render(<ErrorNotice error={error} onRetry={() => {}} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Music catalog is unavailable, try again");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("titles the page", () => {
    render(<PageHeader title="OK Computer" eyebrow="Album" />);

    expect(screen.getByRole("heading", { level: 1, name: "OK Computer" })).toBeInTheDocument();
    expect(document.title).toBe("OK Computer | TrackmyTracks");
  });

  it("titles a missing page and links back to search", () => {
    render(
      <MemoryRouter>
        <NotFoundState />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(document.title).toBe("Page not found | TrackmyTracks");
    expect(screen.getByRole("link", { name: "Search music" })).toHaveAttribute("href", "/search");
  });

  it("pages forward and disables the edges", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pages={3} onPageChange={onPageChange} />);

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("hides pagination for a single page", () => {
    const { container } = render(<Pagination page={1} pages={1} onPageChange={() => {}} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("marks the selected option and reports changes", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Result type"
        options={[
          { value: "song", label: "Songs" },
          { value: "album", label: "Albums" },
        ]}
        value="song"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("group", { name: "Result type" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Songs" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Albums" }));

    expect(onChange).toHaveBeenCalledWith("album");
  });

  it("keeps a hidden text field label accessible", () => {
    render(<TextField label="Search music" hideLabel />);

    expect(screen.getByLabelText("Search music")).toBeInTheDocument();
    expect(screen.getByText("Search music")).toHaveClass("visually-hidden");
  });
});

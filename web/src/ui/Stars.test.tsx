import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Stars } from "./Stars";

describe("Stars", () => {
  it("describes a decimal average", () => {
    render(<Stars value={3.7} label="Community rating" />);

    expect(screen.getByRole("img", { name: "Community rating: 3.7 out of 5" })).toBeInTheDocument();
  });

  it("describes a missing rating", () => {
    render(<Stars value={null} label="Community rating" />);

    expect(screen.getByRole("img", { name: "Community rating: not rated" })).toBeInTheDocument();
  });

  it("steps by half stars from the keyboard", async () => {
    const onChange = vi.fn();
    render(<Stars value={3} label="Your rating" onChange={onChange} />);

    screen.getByRole("slider", { name: "Your rating" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{End}");

    expect(onChange.mock.calls).toEqual([[3.5], [5]]);
  });

  it("starts at half a star when unrated", async () => {
    const onChange = vi.fn();
    render(<Stars value={null} label="Your rating" onChange={onChange} />);

    screen.getByRole("slider").focus();
    await userEvent.keyboard("{ArrowLeft}");

    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it("picks the half star under the pointer", () => {
    const onChange = vi.fn();
    render(<Stars value={null} label="Your rating" onChange={onChange} />);
    const slider = screen.getByRole("slider");
    slider.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect;

    fireEvent.click(slider, { clientX: 71 });

    expect(onChange).toHaveBeenCalledWith(4);
  });
});

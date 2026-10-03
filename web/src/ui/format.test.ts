import { describe, expect, it } from "vitest";
import { formatAverage, formatDate, formatDuration, pluralize } from "./format";

describe("format", () => {
  it("shows averages with one decimal", () => {
    expect(formatAverage(3.7)).toBe("3.7");
    expect(formatAverage(4)).toBe("4.0");
  });

  it("formats track length as minutes and seconds", () => {
    expect(formatDuration(284400)).toBe("4:44");
    expect(formatDuration(61000)).toBe("1:01");
  });

  it("formats dates for people", () => {
    expect(formatDate("2026-10-02T18:30:00+00:00")).toBe("Oct 2, 2026");
  });

  it("pluralizes nouns", () => {
    expect(pluralize(1, "song")).toBe("1 song");
    expect(pluralize(3, "song")).toBe("3 songs");
  });
});

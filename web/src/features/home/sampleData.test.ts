import { describe, expect, it } from "vitest";
import { TRENDING } from "./sampleData";

describe("sample data", () => {
  it("backs every trending average with ratings", () => {
    for (const { song, community } of TRENDING) {
      expect(community.count, song.title).toBeGreaterThan(0);
    }
  });
});

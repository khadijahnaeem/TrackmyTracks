import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  vi.mocked(Element.prototype.scrollIntoView).mockClear();
  cleanup();
  vi.unstubAllGlobals();
});

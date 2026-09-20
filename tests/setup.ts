import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@solidjs/testing-library";
import { fakeBrowser } from "wxt/testing/fake-browser";

beforeEach(() => {
  fakeBrowser.reset();
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

import { describe, it, expect } from "vitest";
import { resolvePacing, PRESETS } from "./pacing";

describe("PRESETS", () => {
  it("has turbo preset with no batching", () => {
    expect(PRESETS.turbo).toEqual({ delayMs: 100, batchSize: 0, cooldownMs: 0 });
  });

  it("has balanced preset with batching", () => {
    expect(PRESETS.balanced).toEqual({ delayMs: 250, batchSize: 30, cooldownMs: 1500 });
  });

  it("has safe preset with smaller batches", () => {
    expect(PRESETS.safe).toEqual({ delayMs: 400, batchSize: 20, cooldownMs: 3000 });
  });
});

describe("resolvePacing", () => {
  it("returns turbo preset", () => {
    expect(resolvePacing("turbo")).toEqual(PRESETS.turbo);
  });

  it("returns balanced preset", () => {
    expect(resolvePacing("balanced")).toEqual(PRESETS.balanced);
  });

  it("returns safe preset", () => {
    expect(resolvePacing("safe")).toEqual(PRESETS.safe);
  });

  it("returns balanced for auto mode", () => {
    expect(resolvePacing("auto")).toEqual(PRESETS.balanced);
  });

  it("returns custom values", () => {
    expect(resolvePacing("custom", { delayMs: 500, batchSize: 10 }))
      .toEqual({ delayMs: 500, batchSize: 10, cooldownMs: 0 });
  });

  it("falls back to balanced when custom values missing", () => {
    expect(resolvePacing("custom")).toEqual(PRESETS.balanced);
  });
});

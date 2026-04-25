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

  it("returns custom values with derived cooldown", () => {
    expect(resolvePacing("custom", { delayMs: 500, batchSize: 10 }))
      .toEqual({ delayMs: 500, batchSize: 10, cooldownMs: 3000 });
  });

  it("returns no cooldown when custom batch size is 0", () => {
    expect(resolvePacing("custom", { delayMs: 500, batchSize: 0 }))
      .toEqual({ delayMs: 500, batchSize: 0, cooldownMs: 0 });
  });

  it("enforces minimum 1s cooldown for custom", () => {
    expect(resolvePacing("custom", { delayMs: 50, batchSize: 5 }))
      .toEqual({ delayMs: 50, batchSize: 5, cooldownMs: 1000 });
  });

  it("falls back to balanced when custom values missing", () => {
    expect(resolvePacing("custom")).toEqual(PRESETS.balanced);
  });
});

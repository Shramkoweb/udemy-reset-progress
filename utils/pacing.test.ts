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

describe("resolvePacing edge cases", () => {
  const MODES = ["auto", "turbo", "balanced", "safe", "custom"] as const;

  it("resolves every mode to a complete profile", () => {
    for (const mode of MODES) {
      const profile = resolvePacing(mode, { delayMs: 250, batchSize: 30 });
      expect(Number.isFinite(profile.delayMs)).toBe(true);
      expect(Number.isFinite(profile.batchSize)).toBe(true);
      expect(Number.isFinite(profile.cooldownMs)).toBe(true);
    }
  });

  it("hands back a copy so a caller cannot corrupt the presets", () => {
    const first = resolvePacing("safe");
    first.delayMs = 1;
    expect(resolvePacing("safe")).toEqual(PRESETS.safe);
    expect(PRESETS.safe.delayMs).toBe(400);
  });

  it("gives auto and balanced the same profile but separate objects", () => {
    const auto = resolvePacing("auto");
    const balanced = resolvePacing("balanced");
    expect(auto).toEqual(balanced);
    expect(auto).not.toBe(balanced);
  });

  it("ignores the custom values for every non-custom mode", () => {
    expect(resolvePacing("turbo", { delayMs: 999, batchSize: 7 })).toEqual(PRESETS.turbo);
    expect(resolvePacing("auto", { delayMs: 999, batchSize: 7 })).toEqual(PRESETS.balanced);
  });

  it("derives the cooldown from the delay once it clears the 1s floor", () => {
    expect(resolvePacing("custom", { delayMs: 150, batchSize: 5 }).cooldownMs).toBe(1000);
    expect(resolvePacing("custom", { delayMs: 200, batchSize: 5 }).cooldownMs).toBe(1200);
    expect(resolvePacing("custom", { delayMs: 1000, batchSize: 50 }).cooldownMs).toBe(6000);
  });

  it("covers the whole range the settings sliders can produce", () => {
    for (let delayMs = 50; delayMs <= 1000; delayMs += 50) {
      for (let batchSize = 5; batchSize <= 50; batchSize += 5) {
        const profile = resolvePacing("custom", { delayMs, batchSize });
        expect(profile).toEqual({ delayMs, batchSize, cooldownMs: Math.max(1000, delayMs * 6) });
        expect(profile.cooldownMs).toBeGreaterThanOrEqual(profile.delayMs);
      }
    }
  });

  it("treats a negative custom batch size as batching off", () => {
    expect(resolvePacing("custom", { delayMs: 300, batchSize: -1 }))
      .toEqual({ delayMs: 300, batchSize: -1, cooldownMs: 0 });
  });

  it("keeps every preset cooldown at least as long as its delay", () => {
    for (const preset of Object.values(PRESETS)) {
      if (preset.batchSize > 0) expect(preset.cooldownMs).toBeGreaterThan(preset.delayMs);
    }
  });

  it("orders the presets from fastest to safest", () => {
    expect(PRESETS.turbo.delayMs).toBeLessThan(PRESETS.balanced.delayMs);
    expect(PRESETS.balanced.delayMs).toBeLessThan(PRESETS.safe.delayMs);
    expect(PRESETS.safe.batchSize).toBeLessThan(PRESETS.balanced.batchSize);
    expect(PRESETS.safe.cooldownMs).toBeGreaterThan(PRESETS.balanced.cooldownMs);
  });
});

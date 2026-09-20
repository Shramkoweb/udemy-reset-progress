import { beforeEach, describe, expect, it, vi } from "vitest";
import { storage } from "wxt/utils/storage";
import { fakeBrowser } from "wxt/testing/fake-browser";

import type { Mode } from "./pacing";
import { DEFAULT_REVIEW_STATE } from "./review";
import {
  AMO_REVIEW_URL, AMO_URL, browserName, CWS_REVIEW_URL, CWS_URL, customBatchSizeItem,
  customDelayItem, isFirefox, migrateStorage, modeItem, popupOpensItem, reviewStateItem,
  storeReviewUrl, storeUrl, successCountItem,
} from "./storage";

const asFirefox = () => vi.spyOn(navigator, "userAgent", "get")
  .mockReturnValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0");

const asChrome = () => vi.spyOn(navigator, "userAgent", "get")
  .mockReturnValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");

beforeEach(async () => {
  await storage.clear("local");
});

describe("store links", () => {
  it("points the review links at the listing they belong to", () => {
    expect(CWS_REVIEW_URL).toBe(`${CWS_URL}/reviews`);
    expect(AMO_REVIEW_URL).toBe(`${AMO_URL}reviews/`);
  });

  it("builds review URLs that are still well-formed", () => {
    for (const url of [CWS_URL, AMO_URL, CWS_REVIEW_URL, AMO_REVIEW_URL]) {
      expect(() => new URL(url)).not.toThrow();
      expect(url.startsWith("https://")).toBe(true);
    }
  });

  it("avoids a double slash in the Firefox review URL", () => {
    expect(AMO_REVIEW_URL).not.toContain("//reviews");
  });
});

describe("browser detection", () => {
  it("recognises Firefox", () => {
    asFirefox();
    expect(isFirefox()).toBe(true);
    expect(browserName()).toBe("Firefox");
    expect(storeUrl()).toBe(AMO_URL);
    expect(storeReviewUrl()).toBe(AMO_REVIEW_URL);
  });

  it("treats everything else as Chrome", () => {
    asChrome();
    expect(isFirefox()).toBe(false);
    expect(browserName()).toBe("Chrome");
    expect(storeUrl()).toBe(CWS_URL);
    expect(storeReviewUrl()).toBe(CWS_REVIEW_URL);
  });

  it("sends Edge and Safari down the Chrome path", () => {
    for (const ua of ["Mozilla/5.0 Chrome/131 Edg/131.0", "Mozilla/5.0 Version/17.0 Safari/605.1.15"]) {
      vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
      expect(isFirefox()).toBe(false);
      expect(storeUrl()).toBe(CWS_URL);
    }
  });
});

describe("storage defaults", () => {
  it("starts every user on auto with the balanced custom values", async () => {
    expect(await modeItem.getValue()).toBe("auto");
    expect(await customDelayItem.getValue()).toBe(250);
    expect(await customBatchSizeItem.getValue()).toBe(30);
  });

  it("starts the counters and the review state empty", async () => {
    expect(await popupOpensItem.getValue()).toBe(0);
    expect(await successCountItem.getValue()).toBe(0);
    expect(await reviewStateItem.getValue()).toEqual(DEFAULT_REVIEW_STATE);
  });

  it("round-trips a written value", async () => {
    await modeItem.setValue("safe");
    await customDelayItem.setValue(750);
    await customBatchSizeItem.setValue(10);
    await successCountItem.setValue(4);

    expect(await modeItem.getValue()).toBe("safe");
    expect(await customDelayItem.getValue()).toBe(750);
    expect(await customBatchSizeItem.getValue()).toBe(10);
    expect(await successCountItem.getValue()).toBe(4);
  });

  it("keeps the review state shape intact across a write", async () => {
    const next = { ...DEFAULT_REVIEW_STATE, stage: "rated" as const, promptCount: 1 };
    await reviewStateItem.setValue(next);
    expect(await reviewStateItem.getValue()).toEqual(next);
  });

  it("stores everything in the local area", async () => {
    await modeItem.setValue("turbo");
    await successCountItem.setValue(2);
    expect(await fakeBrowser.storage.local.get(null)).toMatchObject({ mode: "turbo", successCount: 2 });
  });
});

describe("migrateStorage", () => {
  const migratedMode = async (oldDelay: number): Promise<Mode> => {
    await storage.setItem("local:delay", oldDelay);
    await migrateStorage();
    return (await modeItem.getValue()) as Mode;
  };

  it("lands a fresh install on auto", async () => {
    await migrateStorage();
    expect(await modeItem.getValue()).toBe("auto");
    expect(await storage.getItem("local:delay")).toBeNull();
  });

  it.each([
    [0, "auto"],
    [50, "auto"],
    [51, "turbo"],
    [100, "turbo"],
    [149, "turbo"],
    [150, "balanced"],
    [250, "balanced"],
    [300, "balanced"],
    [301, "safe"],
    [400, "safe"],
    [1000, "safe"],
  ])("maps an old %ims delay to %s", async (oldDelay, expected) => {
    expect(await migratedMode(oldDelay)).toBe(expected);
  });

  it("removes the old delay key once it has been read", async () => {
    await storage.setItem("local:delay", 400);
    await migrateStorage();
    expect(await storage.getItem("local:delay")).toBeNull();
  });

  it("is a no-op when a mode has already been chosen", async () => {
    await modeItem.setValue("turbo");
    await storage.setItem("local:delay", 900);

    await migrateStorage();

    expect(await modeItem.getValue()).toBe("turbo");
    expect(await storage.getItem("local:delay")).toBe(900);
  });

  it("does not undo a migration when it runs again", async () => {
    await storage.setItem("local:delay", 900);
    await migrateStorage();
    await migrateStorage();
    expect(await modeItem.getValue()).toBe("safe");
  });

  it("leaves unrelated keys untouched", async () => {
    await successCountItem.setValue(7);
    await reviewStateItem.setValue({ ...DEFAULT_REVIEW_STATE, promptCount: 2 });
    await storage.setItem("local:delay", 400);

    await migrateStorage();

    expect(await successCountItem.getValue()).toBe(7);
    expect((await reviewStateItem.getValue()).promptCount).toBe(2);
  });

  it("produces a mode that the pacing resolver understands", async () => {
    const { resolvePacing } = await import("./pacing");
    await storage.setItem("local:delay", 800);
    await migrateStorage();
    expect(resolvePacing(await modeItem.getValue())).toEqual({ delayMs: 400, batchSize: 20, cooldownMs: 3000 });
  });
});

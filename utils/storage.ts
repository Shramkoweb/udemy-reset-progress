import { storage } from "wxt/utils/storage";
import type { Mode } from "./pacing";

export const CWS_URL = "https://chromewebstore.google.com/detail/udemy-reset-progress/dddnklikfgdefjekcbhehjogkpfkbdlo";
export const AMO_URL = "https://addons.mozilla.org/en-US/firefox/addon/udemy-reset-progress/";

export const modeItem = storage.defineItem<Mode>("local:mode", {
  defaultValue: "auto",
});

export const customDelayItem = storage.defineItem<number>("local:customDelay", {
  defaultValue: 250,
});

export const customBatchSizeItem = storage.defineItem<number>("local:customBatchSize", {
  defaultValue: 30,
});

export const popupOpensItem = storage.defineItem<number>("local:popupOpens", {
  defaultValue: 0,
});

export const successCountItem = storage.defineItem<number>("local:successCount", {
  defaultValue: 0,
});

/**
 * Migrate from old single-delay storage to new mode-based storage.
 * Runs once — if modeItem already has a value, this is a no-op.
 */
export async function migrateStorage(): Promise<void> {
  const existing = await storage.getItem<Mode>("local:mode");
  if (existing !== null) return;

  const oldDelay = await storage.getItem<number>("local:delay");

  let mode: Mode = "auto";
  if (oldDelay !== null) {
    if (oldDelay <= 50) mode = "auto";
    else if (oldDelay < 150) mode = "turbo";
    else if (oldDelay <= 300) mode = "balanced";
    else mode = "safe";

    await storage.removeItem("local:delay");
  }

  await modeItem.setValue(mode);
}

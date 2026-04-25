import { storage } from "wxt/utils/storage";

export const DEFAULT_DELAY_MS = 50;

export const CWS_URL = "https://chromewebstore.google.com/detail/udemy-reset-progress/dddnklikfgdefjekcbhehjogkpfkbdlo";
export const AMO_URL = "https://addons.mozilla.org/en-US/firefox/addon/udemy-reset-progress/";

export const delayItem = storage.defineItem<number>("local:delay", {
  defaultValue: DEFAULT_DELAY_MS,
});

export const popupOpensItem = storage.defineItem<number>("local:popupOpens", {
  defaultValue: 0,
});

export const successCountItem = storage.defineItem<number>("local:successCount", {
  defaultValue: 0,
});

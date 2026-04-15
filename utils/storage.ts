import { storage } from "wxt/utils/storage";

export const DEFAULT_DELAY_MS = 50;

export const delayItem = storage.defineItem<number>("local:delay", {
  defaultValue: DEFAULT_DELAY_MS,
});

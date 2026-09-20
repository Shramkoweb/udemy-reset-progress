import { vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import type { ScriptResult } from "@/content-scripts/reset-udemy-progress";

export const MANIFEST_VERSION = "2.1.0";
export const ACTIVE_TAB_ID = 7;

export type PopupHarness = ReturnType<typeof mockPopupEnvironment>;

export function mockPopupEnvironment(options: { noTab?: boolean } = {}) {
  const query = vi.spyOn(fakeBrowser.tabs, "query")
    .mockResolvedValue([options.noTab ? {} : { id: ACTIVE_TAB_ID }] as never);

  const executeScript = vi.spyOn(fakeBrowser.scripting, "executeScript")
    .mockResolvedValue([{ result: undefined }] as never);

  const getManifest = vi.spyOn(fakeBrowser.runtime, "getManifest")
    .mockReturnValue({ version: MANIFEST_VERSION } as never);

  const setUninstallURL = vi.spyOn(fakeBrowser.runtime, "setUninstallURL")
    .mockResolvedValue(undefined as never);

  const openOptionsPage = vi.spyOn(fakeBrowser.runtime, "openOptionsPage")
    .mockResolvedValue(undefined as never);

  const writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText }, configurable: true, writable: true,
  });

  const resolveScriptWith = (result: ScriptResult | undefined) => {
    executeScript.mockResolvedValue([{ result }] as never);
  };

  return {
    query, executeScript, getManifest, setUninstallURL, openOptionsPage, writeText,
    resolveScriptWith,
    failScriptWith: (error: "NO_CURRICULUM" | "NO_SECTIONS" | string) =>
      resolveScriptWith({ success: false, error } as ScriptResult),
    succeedScriptWith: (toggled: number) => resolveScriptWith({ success: true, toggled }),
    throwOnExecute: () => executeScript.mockRejectedValue(new Error("Cannot access contents of the page")),
  };
}

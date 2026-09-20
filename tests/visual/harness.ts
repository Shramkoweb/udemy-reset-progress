import { expect, type Locator, type Page } from "@playwright/test";

export type ScriptOutcome =
  | { kind: "success"; toggled?: number }
  | { kind: "failure"; error: "NO_CURRICULUM" | "NO_SECTIONS" | string }
  | { kind: "hang" }
  | { kind: "throw" }
  | { kind: "silent" };

export type ExtensionState = {
  /** Seeded straight into chrome.storage.local, so keys are unprefixed. */
  storage?: Record<string, unknown>;
  version?: string;
  script?: ScriptOutcome;
  noTab?: boolean;
  /** Stops the timers that clear the Done flash and the Saved badge mid-screenshot. */
  freezeTimers?: boolean;
};

type StubConfig = Required<Pick<ExtensionState, "storage" | "version" | "script" | "noTab">>;

function installStub(config: StubConfig) {
  const store: Record<string, unknown> = { ...config.storage };
  const listeners: ((changes: Record<string, unknown>, area: string) => void)[] = [];

  const gets: string[] = [];
  const pick = (keys: unknown) => {
    gets.push(String(keys));
    if (keys == null) return { ...store };
    const list = Array.isArray(keys) ? keys : [keys];
    const out: Record<string, unknown> = {};
    for (const key of list) if (key in store) out[String(key)] = store[String(key)];
    return out;
  };

  const runScript = async () => {
    switch (config.script.kind) {
      case "hang": return new Promise(() => {});
      case "throw": throw new Error("Cannot access contents of the page");
      case "silent": return [{ result: undefined }];
      case "failure": return [{ result: { success: false, error: config.script.error } }];
      default: return [{ result: { success: true, toggled: config.script.toggled ?? 12 } }];
    }
  };

  const opened: string[] = [];
  Object.assign(globalThis, {
    __opened: opened,
    __gets: gets,
    chrome: {
      runtime: {
        id: "visual-test-extension",
        getManifest: () => ({ version: config.version }),
        setUninstallURL: async () => {},
        openOptionsPage: async () => { opened.push("options"); },
        getURL: (path: string) => path,
      },
      storage: {
        local: {
          get: async (keys: unknown) => pick(keys),
          set: async (items: Record<string, unknown>) => {
            const changes: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(items)) {
              changes[key] = { oldValue: store[key], newValue: value };
              store[key] = value;
            }
            listeners.forEach((fn) => fn(changes, "local"));
          },
          remove: async (keys: unknown) => {
            for (const key of (Array.isArray(keys) ? keys : [keys])) delete store[String(key)];
          },
          clear: async () => { for (const key of Object.keys(store)) delete store[key]; },
          onChanged: {
            addListener: (fn: never) => listeners.push(fn),
            removeListener: (fn: never) => listeners.splice(listeners.indexOf(fn), 1),
          },
        },
      },
      tabs: {
        query: async () => [config.noTab ? {} : { id: 1 }],
        create: async ({ url }: { url: string }) => { opened.push(url); return { id: 2 }; },
      },
      scripting: { executeScript: runScript },
    },
  });
}

const DEFAULTS: StubConfig = {
  storage: {}, version: "2.1.0", script: { kind: "success" }, noTab: false,
};

/** onMount seeds the view from storage after first paint; a screenshot before that is stale. */
async function waitForSettled(page: Page) {
  await page.waitForFunction(() => document.querySelector("#root")?.childElementCount === 1);
  await page.waitForFunction(() => {
    const scope = globalThis as unknown as { __gets: string[]; __seenGets?: number };
    if (scope.__gets.length === 0) return false;
    if (scope.__seenGets === scope.__gets.length) return true;
    scope.__seenGets = scope.__gets.length;
    return false;
  }, null, { polling: 100 });
}

async function open(page: Page, path: string, state: ExtensionState) {
  if (state.freezeTimers) await page.clock.install();
  await page.addInitScript(installStub, { ...DEFAULTS, ...state } as StubConfig);
  await page.goto(path);
  await waitForSettled(page);
  // #root fills the viewport; the app's own element is the 320px the user sees.
  return page.locator("#root > *");
}

export const openPopup = (page: Page, state: ExtensionState = {}) => open(page, "/popup.html", state);
export const openOptions = (page: Page, state: ExtensionState = {}) => open(page, "/options.html", state);

export const openedUrls = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as { __opened: string[] }).__opened);

export const DAY_MS = 86_400_000;

/** Enough history for the review prompt to fire on the next successful run. */
export const armedForReview = (successCount = 3) => ({
  successCount,
  reviewState: {
    stage: "idle", firstSuccessAt: Date.now() - 2 * DAY_MS,
    snoozeUntil: 0, promptCount: 0, lastSentiment: null,
  },
});

export async function shot(target: Locator, name: string) {
  await expect(target).toHaveScreenshot(`${name}.png`);
}

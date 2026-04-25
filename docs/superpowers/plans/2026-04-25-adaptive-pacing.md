# Adaptive Pacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat 50ms delay with adaptive pacing that prevents Udemy 401 logouts, add progress reporting to the popup, and redesign the options page with progressive disclosure (Auto / Presets / Advanced).

**Architecture:** New `utils/pacing.ts` module owns all pacing logic (pure functions). Storage model changes from a single `delay` number to a `mode` discriminated by type. Content scripts accept a `PacingProfile` and report progress via `browser.runtime.sendMessage`. Options page becomes a three-layer progressive disclosure UI.

**Tech Stack:** SolidJS, TypeScript, WXT, TailwindCSS + DaisyUI, Vitest (new — for pacing unit tests)

**Spec:** `docs/superpowers/specs/2026-04-25-adaptive-pacing-design.md`
**UI Mockup:** `docs/mockup-options.html`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `utils/pacing.ts` | Create | `PacingProfile` type, `Mode` type, `PRESETS`, `AUTO_TIERS`, `resolvePacing()` |
| `utils/pacing.test.ts` | Create | Unit tests for `resolvePacing()` |
| `utils/storage.ts` | Modify | Replace `delayItem`/`DEFAULT_DELAY_MS` with `modeItem`, `customDelayItem`, `customBatchSizeItem`, add `migrateStorage()` |
| `content-scripts/reset-udemy-progress.ts` | Modify | Accept `PacingProfile`, add batching + cooldown, send progress messages |
| `content-scripts/complete-udemy-progress.ts` | Modify | Same changes as reset script |
| `entrypoints/popup/app.tsx` | Modify | Resolve pacing, pass config to scripts, listen for progress, show counter in button |
| `entrypoints/options/app.tsx` | Modify | Full redesign: Auto toggle, preset cards, Advanced panel |
| `vitest.config.ts` | Create | Vitest configuration |
| `package.json` | Modify | Add vitest dev dependency + test script |

---

### Task 1: Add Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

Run:
```bash
pnpm add -D vitest
```

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname),
    },
  },
  test: {
    globals: true,
  },
});
```

- [ ] **Step 3: Add test script to package.json**

Add to `scripts` in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify vitest runs**

Run:
```bash
pnpm test
```

Expected: `No test files found` (no error, just no tests yet).

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "build: add vitest for unit testing"
```

---

### Task 2: Pacing Engine — Types and Presets

**Files:**
- Create: `utils/pacing.ts`
- Create: `utils/pacing.test.ts`

- [ ] **Step 1: Write failing tests for presets and resolvePacing**

Create `utils/pacing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolvePacing, PRESETS, type PacingProfile } from "./pacing";

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
  describe("preset modes", () => {
    it("returns turbo preset", () => {
      expect(resolvePacing("turbo", 0)).toEqual(PRESETS.turbo);
    });

    it("returns balanced preset", () => {
      expect(resolvePacing("balanced", 0)).toEqual(PRESETS.balanced);
    });

    it("returns safe preset", () => {
      expect(resolvePacing("safe", 0)).toEqual(PRESETS.safe);
    });
  });

  describe("auto mode", () => {
    it("uses fast tier for small courses (< 50 lessons)", () => {
      const result = resolvePacing("auto", 30);
      expect(result).toEqual({ delayMs: 150, batchSize: 0, cooldownMs: 0 });
    });

    it("uses medium tier for mid courses (50-150 lessons)", () => {
      const result = resolvePacing("auto", 80);
      expect(result).toEqual({ delayMs: 250, batchSize: 30, cooldownMs: 1500 });
    });

    it("uses slow tier for large courses (150+ lessons)", () => {
      const result = resolvePacing("auto", 200);
      expect(result).toEqual({ delayMs: 300, batchSize: 25, cooldownMs: 2500 });
    });

    it("uses fast tier at boundary (49 lessons)", () => {
      expect(resolvePacing("auto", 49)).toEqual({ delayMs: 150, batchSize: 0, cooldownMs: 0 });
    });

    it("uses medium tier at boundary (50 lessons)", () => {
      expect(resolvePacing("auto", 50)).toEqual({ delayMs: 250, batchSize: 30, cooldownMs: 1500 });
    });

    it("uses slow tier at boundary (150 lessons)", () => {
      expect(resolvePacing("auto", 150)).toEqual({ delayMs: 300, batchSize: 25, cooldownMs: 2500 });
    });
  });

  describe("custom mode", () => {
    it("returns custom values", () => {
      const result = resolvePacing("custom", 0, { delayMs: 500, batchSize: 10 });
      expect(result).toEqual({ delayMs: 500, batchSize: 10, cooldownMs: 0 });
    });

    it("falls back to balanced when custom values missing", () => {
      const result = resolvePacing("custom", 0);
      expect(result).toEqual(PRESETS.balanced);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm test
```

Expected: FAIL — `Cannot find module './pacing'`

- [ ] **Step 3: Write pacing module**

Create `utils/pacing.ts`:

```ts
export type PacingProfile = {
  delayMs: number;
  batchSize: number;
  cooldownMs: number;
};

export type Mode = "auto" | "turbo" | "balanced" | "safe" | "custom";

export const PRESETS = {
  turbo:    { delayMs: 100, batchSize: 0,  cooldownMs: 0    },
  balanced: { delayMs: 250, batchSize: 30, cooldownMs: 1500 },
  safe:     { delayMs: 400, batchSize: 20, cooldownMs: 3000 },
} as const satisfies Record<string, PacingProfile>;

const AUTO_TIERS: { maxLessons: number; profile: PacingProfile }[] = [
  { maxLessons: 50,       profile: { delayMs: 150, batchSize: 0,  cooldownMs: 0    } },
  { maxLessons: 150,      profile: { delayMs: 250, batchSize: 30, cooldownMs: 1500 } },
  { maxLessons: Infinity, profile: { delayMs: 300, batchSize: 25, cooldownMs: 2500 } },
];

export function resolvePacing(
  mode: Mode,
  lessonCount: number,
  custom?: { delayMs: number; batchSize: number },
): PacingProfile {
  switch (mode) {
    case "turbo":
    case "balanced":
    case "safe":
      return { ...PRESETS[mode] };

    case "auto": {
      const tier = AUTO_TIERS.find(t => lessonCount < t.maxLessons) ?? AUTO_TIERS[AUTO_TIERS.length - 1];
      return { ...tier.profile };
    }

    case "custom":
      if (!custom) return { ...PRESETS.balanced };
      return { delayMs: custom.delayMs, batchSize: custom.batchSize, cooldownMs: 0 };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm test
```

Expected: All 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/pacing.ts utils/pacing.test.ts
git commit -m "feat: add pacing engine with auto tiers and presets"
```

---

### Task 3: Update Storage Model

**Files:**
- Modify: `utils/storage.ts`

- [ ] **Step 1: Read current storage.ts**

Read `utils/storage.ts` to confirm current state.

- [ ] **Step 2: Replace storage items**

Replace the full content of `utils/storage.ts` with:

```ts
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
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
pnpm compile
```

Expected: Errors in `popup/app.tsx` and `options/app.tsx` because they reference removed `delayItem` and `DEFAULT_DELAY_MS`. This is expected — those files are updated in later tasks.

- [ ] **Step 4: Commit**

```bash
git add utils/storage.ts
git commit -m "feat: replace delay storage with mode-based pacing storage"
```

---

### Task 4: Update Content Scripts

**Files:**
- Modify: `content-scripts/reset-udemy-progress.ts`
- Modify: `content-scripts/complete-udemy-progress.ts`

- [ ] **Step 1: Update reset-udemy-progress.ts**

Replace the full content of `content-scripts/reset-udemy-progress.ts` with:

```ts
export type ScriptResult = {
  success: true;
  toggled: number;
} | {
  success: false;
  error: "NO_CURRICULUM" | "NO_SECTIONS";
};

type PacingInput = {
  delayMs: number;
  batchSize: number;
  cooldownMs: number;
};

export const resetUdemyProgress = async (pacing: PacingInput): Promise<ScriptResult> => {
  const SELECTOR = {
    SECTION_CONTAINER: "[data-purpose='curriculum-section-container']",
    SECTION_TOGGLE: "[data-css-toggle-id]",
    CHECKED_ATTR: "data-checked",
    LESSON_CONTAINER: "[data-purpose^='section-panel-']",
    LESSON_TOGGLE: "[data-purpose='progress-toggle-button']"
  } as const;

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const section = document.querySelector(SELECTOR.SECTION_CONTAINER);
  if (!section) {
    return { success: false, error: "NO_CURRICULUM" };
  }

  const sectionToggles = section.querySelectorAll(SELECTOR.SECTION_TOGGLE);
  if (!sectionToggles || sectionToggles.length === 0) {
    return { success: false, error: "NO_SECTIONS" };
  }

  const lessons = document.querySelectorAll(SELECTOR.LESSON_CONTAINER);
  let toggled = 0;

  const allButtons: HTMLInputElement[] = [];
  for (const lesson of lessons) {
    const buttons = lesson.querySelectorAll(SELECTOR.LESSON_TOGGLE);
    for (const button of buttons) {
      if (button instanceof HTMLInputElement && button.checked) {
        allButtons.push(button);
      }
    }
  }

  const total = allButtons.length;

  for (const toggler of sectionToggles) {
    const previousElement = toggler.previousElementSibling;
    const isTogglerChecked = previousElement?.getAttribute(SELECTOR.CHECKED_ATTR) === "checked";

    if (!isTogglerChecked && toggler instanceof HTMLElement) {
      toggler.click();
      await sleep(pacing.delayMs);
    }

    for (const lesson of lessons) {
      const completeProgressButtons = lesson.querySelectorAll(SELECTOR.LESSON_TOGGLE);

      for (const button of completeProgressButtons) {
        if (button instanceof HTMLInputElement && button.checked) {
          button.click();
          toggled++;

          try {
            chrome.runtime.sendMessage({ type: "progress", current: toggled, total });
          } catch {}

          const isBatchEnd = pacing.batchSize > 0 && toggled % pacing.batchSize === 0;
          await sleep(isBatchEnd ? pacing.cooldownMs : pacing.delayMs);
        }
      }
    }

    if (toggler instanceof HTMLElement) {
      toggler.click();
    }
  }

  return { success: true, toggled };
};
```

- [ ] **Step 2: Update complete-udemy-progress.ts**

Replace the full content of `content-scripts/complete-udemy-progress.ts` with:

```ts
export type CompleteResult = {
  success: true;
  toggled: number;
} | {
  success: false;
  error: "NO_CURRICULUM" | "NO_SECTIONS";
};

type PacingInput = {
  delayMs: number;
  batchSize: number;
  cooldownMs: number;
};

export const completeUdemyProgress = async (pacing: PacingInput): Promise<CompleteResult> => {
  const SELECTOR = {
    SECTION_CONTAINER: "[data-purpose='curriculum-section-container']",
    SECTION_TOGGLE: "[data-css-toggle-id]",
    CHECKED_ATTR: "data-checked",
    LESSON_CONTAINER: "[data-purpose^='section-panel-']",
    LESSON_TOGGLE: "[data-purpose='progress-toggle-button']"
  } as const;

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const section = document.querySelector(SELECTOR.SECTION_CONTAINER);
  if (!section) {
    return { success: false, error: "NO_CURRICULUM" };
  }

  const sectionToggles = section.querySelectorAll(SELECTOR.SECTION_TOGGLE);
  if (!sectionToggles || sectionToggles.length === 0) {
    return { success: false, error: "NO_SECTIONS" };
  }

  const lessons = document.querySelectorAll(SELECTOR.LESSON_CONTAINER);
  let toggled = 0;

  const allButtons: HTMLInputElement[] = [];
  for (const lesson of lessons) {
    const buttons = lesson.querySelectorAll(SELECTOR.LESSON_TOGGLE);
    for (const button of buttons) {
      if (button instanceof HTMLInputElement && !button.checked) {
        allButtons.push(button);
      }
    }
  }

  const total = allButtons.length;

  for (const toggler of sectionToggles) {
    const previousElement = toggler.previousElementSibling;
    const isTogglerChecked = previousElement?.getAttribute(SELECTOR.CHECKED_ATTR) === "checked";

    if (!isTogglerChecked && toggler instanceof HTMLElement) {
      toggler.click();
      await sleep(pacing.delayMs);
    }

    for (const lesson of lessons) {
      const completeProgressButtons = lesson.querySelectorAll(SELECTOR.LESSON_TOGGLE);

      for (const button of completeProgressButtons) {
        if (button instanceof HTMLInputElement && !button.checked) {
          button.click();
          toggled++;

          try {
            chrome.runtime.sendMessage({ type: "progress", current: toggled, total });
          } catch {}

          const isBatchEnd = pacing.batchSize > 0 && toggled % pacing.batchSize === 0;
          await sleep(isBatchEnd ? pacing.cooldownMs : pacing.delayMs);
        }
      }
    }

    if (toggler instanceof HTMLElement) {
      toggler.click();
    }
  }

  return { success: true, toggled };
};
```

- [ ] **Step 3: Verify TypeScript compiles for content scripts**

Run:
```bash
pnpm compile
```

Expected: Still errors in popup/options (expected). Content scripts themselves should not have new type errors.

- [ ] **Step 4: Commit**

```bash
git add content-scripts/reset-udemy-progress.ts content-scripts/complete-udemy-progress.ts
git commit -m "feat: add batching, cooldown and progress reporting to content scripts"
```

---

### Task 5: Update Popup

**Files:**
- Modify: `entrypoints/popup/app.tsx`

- [ ] **Step 1: Read current popup/app.tsx**

Read `entrypoints/popup/app.tsx` to confirm current state.

- [ ] **Step 2: Rewrite popup/app.tsx**

Replace the full content of `entrypoints/popup/app.tsx` with:

```tsx
import { createEffect, createSignal, JSX, onCleanup, onMount } from "solid-js";

import type { ScriptResult } from "@/content-scripts/reset-udemy-progress";
import { resetUdemyProgress } from "@/content-scripts/reset-udemy-progress";
import { completeUdemyProgress } from "@/content-scripts/complete-udemy-progress";
import { resolvePacing } from "@/utils/pacing";
import {
  AMO_URL, CWS_URL, modeItem, customDelayItem, customBatchSizeItem,
  popupOpensItem, successCountItem, migrateStorage,
} from "@/utils/storage";

import "~/assets/tailwind.css";

type State = "initial" | "progress" | "done" | "error";
const RESET_TIMEOUT_MS = 2000;

const ERROR_MESSAGES: Record<string, string> = {
  NO_CURRICULUM: "Open a Udemy course page first", NO_SECTIONS: "No course sections found on this page",
};

const STORE_URL = navigator.userAgent.includes("Firefox") ? AMO_URL : CWS_URL;

export default function App() {
  const [resetStatus, setResetStatus] = createSignal<State>("initial");
  const [completeStatus, setCompleteStatus] = createSignal<State>("initial");
  const [errorMessage, setErrorMessage] = createSignal("");
  const [popupOpens, setPopupOpens] = createSignal(0);
  const [successCount, setSuccessCount] = createSignal(0);
  const [shareCopied, setShareCopied] = createSignal(false);
  const [progressText, setProgressText] = createSignal("");
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(async () => {
    await migrateStorage();

    const opens = await popupOpensItem.getValue();
    const next = opens + 1;
    setPopupOpens(next);
    await popupOpensItem.setValue(next);

    const successes = await successCountItem.getValue();
    setSuccessCount(successes);

    browser.runtime.onMessage.addListener((message) => {
      if (message?.type === "progress") {
        setProgressText(`${message.current}/${message.total}`);
      }
    });
  });

  const executeScript = async (func: typeof resetUdemyProgress | typeof completeUdemyProgress, setStatus: (s: State) => void) => {
    if (isAnyInProgress()) return;
    try {
      setStatus("progress");
      setErrorMessage("");
      setProgressText("");
      const [{ id: tabId }] = await browser.tabs.query({
        active: true, currentWindow: true,
      });
      if (!tabId) {
        setErrorMessage("Cannot access the current tab");
        setStatus("error");
        return;
      }

      const mode = await modeItem.getValue();
      const customDelay = await customDelayItem.getValue();
      const customBatch = await customBatchSizeItem.getValue();

      const pacing = resolvePacing(mode, 0, { delayMs: customDelay, batchSize: customBatch });

      const [{ result }] = await browser.scripting.executeScript({
        target: { tabId }, func, args: [pacing],
      });

      const scriptResult = result as ScriptResult | undefined;
      if (scriptResult && !scriptResult.success) {
        setErrorMessage(ERROR_MESSAGES[scriptResult.error] ?? "Something went wrong");
        setStatus("error");
        return;
      }

      const newCount = successCount() + 1;
      setSuccessCount(newCount);
      await successCountItem.setValue(newCount);

      setStatus("done");
    } catch {
      setErrorMessage("Make sure you're on a Udemy page");
      setStatus("error");
    }
  };

  const handleReset = () => executeScript(resetUdemyProgress, setResetStatus);
  const handleComplete = () => executeScript(completeUdemyProgress, setCompleteStatus);

  const handleShare = async () => {
    await navigator.clipboard.writeText(STORE_URL);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  createEffect(() => {
    if (resetStatus() === "done" || resetStatus() === "error") {
      resetTimer = setTimeout(() => {
        setResetStatus("initial");
        setErrorMessage("");
        setProgressText("");
      }, RESET_TIMEOUT_MS);
    }
  });

  createEffect(() => {
    if (completeStatus() === "done" || completeStatus() === "error") {
      resetTimer = setTimeout(() => {
        setCompleteStatus("initial");
        setErrorMessage("");
        setProgressText("");
      }, RESET_TIMEOUT_MS);
    }
  });

  onCleanup(() => {
    if (resetTimer) {
      clearTimeout(resetTimer);
    }
  });

  const openSettings = () => {
    browser.runtime.openOptionsPage();
  };

  const isAnyInProgress = () => resetStatus() === "progress" || completeStatus() === "progress";

  const buttonContent = (status: State, label: string, activeLabel: string): JSX.Element => {
    const map: { [key in State]: JSX.Element } = {
      initial: <span>{label}</span>,
      progress: (
        <span class="inline-flex items-center gap-2">
          <span class="loading loading-spinner loading-xs"></span>
          {progressText() ? `${activeLabel} ${progressText()}` : activeLabel}
        </span>
      ),
      done: <span>Done</span>,
      error: <span>Try Again</span>,
    };
    return map[status];
  };

  const renderFooter = () => {
    if (popupOpens() >= 4 && popupOpens() <= 7) {
      return (<a
        target="_blank"
        href={STORE_URL}
        class="text-[11px] text-ink-muted/40 transition-colors hover:text-ink-muted/60"
      >
        Enjoying this? <span class="text-amber-400">&#9733;</span> Rate
      </a>);
    }
    if (successCount() >= 3) {
      return (<button
        type="button"
        onClick={handleShare}
        class="text-[11px] text-ink-muted/40 transition-colors hover:text-ink-muted/60"
      >
        {shareCopied() ? "Link copied!" : "Share with a friend"}
      </button>);
    }
    return (<a
      target="_blank"
      href="https://shramko.dev/?utm_source=udemy-reset-progress&utm_medium=bottom_link&utm_campaign=all&utm_id=promo"
      class="text-[11px] text-ink-muted/40 transition-colors hover:text-ink-muted/60"
    >
      shramko.dev
    </a>);
  };

  return (<div class="w-80 p-4 font-sans">
    <div class="flex items-center justify-between mb-3.5">
      <div>
        <h1 class="text-[15px] font-semibold tracking-tight text-ink">
          Udemy Reset Progress
        </h1>
        <p class="text-[11px] text-ink-muted mt-0.5">
          Manage your course progress
        </p>
      </div>
      <button
        onClick={openSettings}
        class="rounded-lg p-1.5 bg-surface text-ink-muted transition-all duration-150 hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2"
        aria-label="Settings"
        title="Settings"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>

    <div class="flex flex-col gap-2.5">
      <button
        onClick={handleReset}
        class="w-full h-11 rounded-[10px] text-sm font-medium shadow-sm transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2"
        classList={{
          "bg-brand text-white hover:bg-brand-hover active:scale-[0.98]": resetStatus() === "initial",
          "bg-surface-hover text-ink-muted cursor-wait": resetStatus() === "progress",
          "bg-ok text-white": resetStatus() === "done",
          "bg-bad-soft text-bad hover:brightness-95": resetStatus() === "error",
        }}
        disabled={isAnyInProgress()}
        aria-busy={resetStatus() === "progress"}
        aria-label="Clear Udemy progress"
      >
        {buttonContent(resetStatus(), "Clear Progress", "Resetting...")}
      </button>

      <button
        onClick={handleComplete}
        class="w-full h-11 rounded-[10px] text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2"
        classList={{
          "bg-surface text-ink hover:bg-surface-hover active:scale-[0.98]": completeStatus() === "initial",
          "bg-surface-hover text-ink-muted cursor-wait": completeStatus() === "progress",
          "bg-ok text-white": completeStatus() === "done",
          "bg-bad-soft text-bad hover:brightness-95": completeStatus() === "error",
        }}
        disabled={isAnyInProgress()}
        aria-busy={completeStatus() === "progress"}
        aria-label="Mark all lessons as complete"
      >
        {buttonContent(completeStatus(), "Mark All Complete", "Completing...")}
      </button>
    </div>

    {errorMessage() && (<div class="mt-2.5 flex items-center gap-2 rounded-lg bg-bad-soft px-3 py-2">
      <svg
        xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0 text-bad" viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clip-rule="evenodd"
        />
      </svg>
      <p class="text-xs font-medium text-bad">
        {errorMessage()}
      </p>
    </div>)}

    <div class="mt-3.5 text-center">
      {renderFooter()}
    </div>
  </div>);
}
```

**Key changes from current:**
- Import `resolvePacing`, `modeItem`, `customDelayItem`, `customBatchSizeItem`, `migrateStorage` instead of `delayItem`/`DEFAULT_DELAY_MS`
- Call `migrateStorage()` in `onMount`
- New `progressText` signal, updated by `browser.runtime.onMessage` listener
- `executeScript` resolves pacing from storage mode and passes `PacingProfile` object to content scripts
- `buttonContent` shows progress counter when available

**Note on auto mode lesson count:** The popup passes `lessonCount: 0` to `resolvePacing` because in auto mode the content script counts lessons itself. For auto mode, the popup should resolve pacing differently — but since `resolvePacing("auto", 0)` returns the small-course tier (150ms, no batching), we need to handle this. The content script should resolve its own pacing in auto mode.

**IMPORTANT CORRECTION:** For auto mode to work correctly, the content script needs to know the mode and resolve pacing after counting lessons. Update the approach: popup passes the raw mode + custom values. Content scripts resolve pacing internally for auto mode.

- [ ] **Step 3: Update content scripts to resolve auto pacing internally**

In `content-scripts/reset-udemy-progress.ts`, change the function signature and add internal pacing resolution:

Change the `PacingInput` type and add auto resolution at the top of the function. Replace the type and the first part of the function:

```ts
type PacingInput =
  | { mode: "auto" }
  | { mode: "preset" | "custom"; delayMs: number; batchSize: number; cooldownMs: number };

export const resetUdemyProgress = async (pacingInput: PacingInput): Promise<ScriptResult> => {
  // ... SELECTOR and sleep stay the same ...

  // ... section and sectionToggles checks stay the same ...

  const lessons = document.querySelectorAll(SELECTOR.LESSON_CONTAINER);
  let toggled = 0;

  // Count all actionable buttons first
  let total = 0;
  for (const lesson of lessons) {
    const buttons = lesson.querySelectorAll(SELECTOR.LESSON_TOGGLE);
    for (const button of buttons) {
      if (button instanceof HTMLInputElement && button.checked) {
        total++;
      }
    }
  }

  // Resolve pacing: auto mode uses lesson count, others use provided values
  const AUTO_TIERS = [
    { maxLessons: 50,       delayMs: 150, batchSize: 0,  cooldownMs: 0    },
    { maxLessons: 150,      delayMs: 250, batchSize: 30, cooldownMs: 1500 },
    { maxLessons: Infinity, delayMs: 300, batchSize: 25, cooldownMs: 2500 },
  ];

  let pacing: { delayMs: number; batchSize: number; cooldownMs: number };
  if (pacingInput.mode === "auto") {
    const tier = AUTO_TIERS.find(t => total < t.maxLessons) ?? AUTO_TIERS[AUTO_TIERS.length - 1];
    pacing = { delayMs: tier.delayMs, batchSize: tier.batchSize, cooldownMs: tier.cooldownMs };
  } else {
    pacing = { delayMs: pacingInput.delayMs, batchSize: pacingInput.batchSize, cooldownMs: pacingInput.cooldownMs };
  }

  // ... rest of the loop uses `pacing` as before ...
```

Apply the same pattern to `complete-udemy-progress.ts` (but check `!button.checked` instead of `button.checked` for the total count).

- [ ] **Step 4: Update popup executeScript to pass mode-aware input**

In the `executeScript` function in `popup/app.tsx`, replace the pacing resolution with:

```ts
const mode = await modeItem.getValue();

let pacingArg: { mode: "auto" } | { mode: "preset" | "custom"; delayMs: number; batchSize: number; cooldownMs: number };
if (mode === "auto") {
  pacingArg = { mode: "auto" };
} else {
  const customDelay = await customDelayItem.getValue();
  const customBatch = await customBatchSizeItem.getValue();
  const resolved = resolvePacing(mode, 0, { delayMs: customDelay, batchSize: customBatch });
  pacingArg = { mode: "preset", ...resolved };
}

const [{ result }] = await browser.scripting.executeScript({
  target: { tabId }, func, args: [pacingArg],
});
```

- [ ] **Step 5: Verify TypeScript compiles**

Run:
```bash
pnpm compile
```

Expected: Errors only in `options/app.tsx` (updated in next task).

- [ ] **Step 6: Commit**

```bash
git add entrypoints/popup/app.tsx content-scripts/reset-udemy-progress.ts content-scripts/complete-udemy-progress.ts
git commit -m "feat: add progress reporting and adaptive pacing to popup"
```

---

### Task 6: Redesign Options Page

**Files:**
- Modify: `entrypoints/options/app.tsx`

- [ ] **Step 1: Read current options/app.tsx**

Read `entrypoints/options/app.tsx` to confirm current state.

- [ ] **Step 2: Rewrite options/app.tsx**

Replace the full content of `entrypoints/options/app.tsx` with:

```tsx
import { createSignal, onMount, Show } from "solid-js";

import type { Mode } from "@/utils/pacing";
import { PRESETS } from "@/utils/pacing";
import { modeItem, customDelayItem, customBatchSizeItem } from "@/utils/storage";

import "~/assets/tailwind.css";

const PRESET_OPTIONS: { key: "turbo" | "balanced" | "safe"; name: string; desc: string }[] = [
  { key: "turbo", name: "Turbo", desc: "Fastest speed for small courses" },
  { key: "balanced", name: "Balanced", desc: "Recommended for most courses" },
  { key: "safe", name: "Safe", desc: "Reliable for large courses" },
];

export default function App() {
  const [mode, setMode] = createSignal<Mode>("auto");
  const [customDelay, setCustomDelay] = createSignal(250);
  const [customBatch, setCustomBatch] = createSignal(30);
  const [saved, setSaved] = createSignal(false);
  const [advancedOpen, setAdvancedOpen] = createSignal(false);
  let delayRef: HTMLInputElement | undefined;
  let batchRef: HTMLInputElement | undefined;

  const updateTrackFill = (el: HTMLInputElement | undefined, value: number, min: number, max: number) => {
    if (!el) return;
    const pct = ((value - min) / (max - min)) * 100;
    el.style.background = `linear-gradient(to right, #6366f1 ${pct}%, #e5e5e7 ${pct}%)`;
  };

  onMount(async () => {
    const m = await modeItem.getValue();
    setMode(m);

    const d = await customDelayItem.getValue();
    setCustomDelay(d);

    const b = await customBatchSizeItem.getValue();
    setCustomBatch(b);

    if (m === "custom") setAdvancedOpen(true);

    updateTrackFill(delayRef, d, 50, 1000);
    updateTrackFill(batchRef, b, 5, 50);
  });

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const saveMode = async (m: Mode) => {
    setMode(m);
    await modeItem.setValue(m);
    flashSaved();
  };

  const handleAutoToggle = () => {
    if (mode() === "auto") {
      saveMode("balanced");
    } else {
      setAdvancedOpen(false);
      saveMode("auto");
    }
  };

  const handlePreset = (key: "turbo" | "balanced" | "safe") => {
    if (advancedOpen()) setAdvancedOpen(false);
    saveMode(key);
  };

  const handleAdvancedToggle = () => {
    const opening = !advancedOpen();
    setAdvancedOpen(opening);
    if (opening) {
      saveMode("custom");
      requestAnimationFrame(() => {
        updateTrackFill(delayRef, customDelay(), 50, 1000);
        updateTrackFill(batchRef, customBatch(), 5, 50);
      });
    } else {
      saveMode("balanced");
    }
  };

  const handleDelayChange = async (value: number) => {
    setCustomDelay(value);
    updateTrackFill(delayRef, value, 50, 1000);
    await customDelayItem.setValue(value);
    flashSaved();
  };

  const handleBatchChange = async (value: number) => {
    setCustomBatch(value);
    updateTrackFill(batchRef, value, 5, 50);
    await customBatchSizeItem.setValue(value);
    flashSaved();
  };

  const isAuto = () => mode() === "auto";
  const isPreset = (key: string) => mode() === key;

  return (<div class="max-w-80 mx-auto p-4 font-sans">
    {/* Header */}
    <div class="flex items-center justify-between mb-3.5">
      <div>
        <h1 class="text-[15px] font-semibold tracking-tight text-ink">
          Udemy Reset Progress
        </h1>
        <p class="text-[11px] text-ink-muted mt-0.5">
          Settings
        </p>
      </div>
      <div
        class="text-[11px] font-medium transition-all duration-300"
        classList={{
          "text-ok opacity-100": saved(), "text-ok opacity-0": !saved(),
        }}
      >
        Saved
      </div>
    </div>

    {/* Speed mode card */}
    <div class="overflow-hidden rounded-[10px] bg-surface/50 ring-1 ring-ink/5">
      <div class="p-4">
        {/* Auto toggle row */}
        <div class="flex items-center justify-between">
          <h2 class="text-[13px] font-medium text-ink">Speed mode</h2>
          <label class="flex items-center gap-2 cursor-pointer" onClick={handleAutoToggle}>
            <span class="text-[11px] font-medium text-ink-muted">Auto</span>
            <div
              class="relative w-9 h-5 rounded-full transition-colors duration-200"
              classList={{
                "bg-brand": isAuto(),
                "bg-surface-hover": !isAuto(),
              }}
            >
              <div
                class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
                classList={{ "translate-x-4": isAuto() }}
              />
            </div>
          </label>
        </div>

        {/* Auto description */}
        <Show when={isAuto()}>
          <p class="mt-2.5 text-[11px] leading-relaxed text-ink-muted/60">
            Automatically adjusts speed based on course size. Recommended for most users.
          </p>
        </Show>

        {/* Presets */}
        <Show when={!isAuto()}>
          <div class="mt-3 flex flex-col gap-1.5">
            {PRESET_OPTIONS.map(({ key, name, desc }) => (
              <button
                onClick={() => handlePreset(key)}
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150"
                classList={{
                  "ring-2 ring-brand bg-brand-soft/30": isPreset(key) && !advancedOpen(),
                  "ring-1 ring-ink/5 bg-white hover:bg-surface": !isPreset(key) || advancedOpen(),
                }}
              >
                <div
                  class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                  classList={{
                    "border-brand": isPreset(key) && !advancedOpen(),
                    "border-surface-hover": !isPreset(key) || advancedOpen(),
                  }}
                >
                  <div
                    class="w-2 h-2 rounded-full transition-colors"
                    classList={{
                      "bg-brand": isPreset(key) && !advancedOpen(),
                      "bg-transparent": !isPreset(key) || advancedOpen(),
                    }}
                  />
                </div>
                <div>
                  <div class="text-[12px] font-semibold text-ink">{name}</div>
                  <div class="text-[10px] text-ink-muted mt-0.5">{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </Show>
      </div>
    </div>

    {/* Advanced toggle */}
    <Show when={!isAuto()}>
      <div class="mt-2 text-center">
        <button
          onClick={handleAdvancedToggle}
          class="text-[11px] text-ink-muted/50 hover:text-ink-muted transition-colors px-2 py-1"
        >
          Advanced {advancedOpen() ? "\u25B4" : "\u25BE"}
        </button>
      </div>
    </Show>

    {/* Advanced panel */}
    <Show when={advancedOpen()}>
      <div class="mt-2 overflow-hidden rounded-[10px] bg-surface/50 ring-1 ring-ink/5">
        <div class="p-4">
          {/* Delay slider */}
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[11px] text-ink-muted">Action delay</span>
              <span class="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink/65 ring-1 ring-ink/5">
                {customDelay()}ms
              </span>
            </div>
            <input
              ref={delayRef}
              type="range"
              min="50"
              max="1000"
              step="50"
              value={customDelay()}
              onInput={(e) => handleDelayChange(Number(e.currentTarget.value))}
              class="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-brand"
            />
            <div class="mt-1 flex justify-between text-[10px] font-medium text-ink-muted/40">
              <span>50ms</span>
              <span>1000ms</span>
            </div>
          </div>

          {/* Batch slider */}
          <div class="mt-4">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[11px] text-ink-muted">Batch size</span>
              <span class="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink/65 ring-1 ring-ink/5">
                {customBatch()}
              </span>
            </div>
            <input
              ref={batchRef}
              type="range"
              min="5"
              max="50"
              step="5"
              value={customBatch()}
              onInput={(e) => handleBatchChange(Number(e.currentTarget.value))}
              class="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-brand"
            />
            <div class="mt-1 flex justify-between text-[10px] font-medium text-ink-muted/40">
              <span>5</span>
              <span>50</span>
            </div>
          </div>
        </div>

        <div class="border-t border-ink/5 bg-surface/40 px-4 py-2.5">
          <p class="text-[11px] leading-relaxed text-ink-muted/60">
            Higher delay and smaller batch reduce the chance of unexpected logouts from Udemy.
          </p>
        </div>
      </div>
    </Show>

    {/* Reset to Auto */}
    <Show when={!isAuto()}>
      <button
        onClick={() => { setAdvancedOpen(false); saveMode("auto"); }}
        class="mt-2.5 w-full h-8 rounded-[10px] bg-surface text-[12px] font-medium text-ink-muted hover:bg-surface-hover active:scale-[0.98] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2"
      >
        Reset to Auto
      </button>
    </Show>
  </div>);
}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

Run:
```bash
pnpm compile
```

Expected: No errors.

- [ ] **Step 4: Verify build works**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add entrypoints/options/app.tsx
git commit -m "feat: redesign options page with auto/preset/advanced modes"
```

---

### Task 7: Manual Testing and Polish

**Files:** No new files — testing and fixing.

- [ ] **Step 1: Start dev server**

Run:
```bash
pnpm dev
```

Load the extension in Chrome (chrome://extensions, load unpacked from `.output/chrome-mv3`).

- [ ] **Step 2: Test options page — Auto mode**

1. Open the extension options page
2. Verify Auto toggle is ON by default
3. Verify description text shows: "Automatically adjusts speed..."
4. Verify presets are hidden
5. Verify "Advanced" link is hidden

- [ ] **Step 3: Test options page — Presets**

1. Toggle Auto OFF
2. Verify three preset cards appear (Turbo, Balanced, Safe)
3. Verify Balanced is selected by default
4. Click Turbo — verify selection ring moves
5. Click Safe — verify selection ring moves
6. Verify "Advanced" link appears below presets

- [ ] **Step 4: Test options page — Advanced**

1. Click "Advanced" link
2. Verify sliders appear (delay + batch)
3. Verify preset selection clears
4. Move sliders — verify values update
5. Verify "Saved" indicator flashes
6. Click a preset — verify Advanced collapses

- [ ] **Step 5: Test options page — Reset to Auto**

1. With a preset selected, click "Reset to Auto"
2. Verify returns to Auto state (toggle ON, presets hidden)

- [ ] **Step 6: Test popup — progress counter**

1. Open a Udemy course page
2. Click "Clear Progress" in popup
3. Verify button shows "Resetting... N/M" during operation
4. Verify operation completes without 401 error

- [ ] **Step 7: Test popup — Mark All Complete**

1. Click "Mark All Complete" in popup
2. Verify button shows "Completing... N/M" during operation
3. Verify operation completes without 401 error

- [ ] **Step 8: Test migration**

1. In Chrome DevTools, set `chrome.storage.local` key `delay` to `50`
2. Remove `mode` key
3. Reload extension
4. Open options — verify Auto mode is selected

- [ ] **Step 9: Fix any issues found**

Address any visual or functional issues found during testing.

- [ ] **Step 10: Run final checks**

```bash
pnpm compile && pnpm build && pnpm test
```

All must pass.

- [ ] **Step 11: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

(Only if there are changes to commit.)

---

### Task 8: Cleanup

**Files:**
- Remove: `docs/mockup-options.html` (served its purpose)

- [ ] **Step 1: Remove mockup file**

```bash
git rm docs/mockup-options.html
```

- [ ] **Step 2: Bump version**

In `package.json`, bump version from `1.4.0` to `1.5.0` (new feature).

- [ ] **Step 3: Commit**

```bash
git add package.json docs/mockup-options.html
git commit -m "chore: bump version to 1.5.0"
```

# Adaptive Pacing — Design Spec

## Problem

Udemy invalidates sessions (HTTP 401) when the extension clicks progress toggles too fast. The current default delay of 50ms is too aggressive. Users get logged out of Udemy, especially on large courses. The error surfaces as:

```
Uncaught (in promise) Error: Request failed with status code 401
```

Once a 401 fires, the session is dead — retry is impossible. Prevention is the only fix.

## Solution

Replace the flat delay with adaptive pacing (auto-adjusts based on course size) and redesign the options page around progressive disclosure: Auto mode for most users, presets for simple manual control, and advanced sliders for power users.

## Architecture

### Pacing Engine (`utils/pacing.ts` — new file)

Single source of truth for all delay/batch/cooldown logic.

```ts
type PacingProfile = {
  delayMs: number;
  batchSize: number;   // 0 = no batching
  cooldownMs: number;  // pause after each batch
};

type Mode = "auto" | "turbo" | "balanced" | "safe" | "custom";
```

**Presets (constants, not stored):**

| Preset   | delayMs | batchSize | cooldownMs |
|----------|---------|-----------|------------|
| turbo    | 100     | 0         | 0          |
| balanced | 250     | 30        | 1500       |
| safe     | 400     | 20        | 3000       |

**Auto tiers (resolved at runtime from lesson count):**

| Lessons | delayMs | batchSize | cooldownMs |
|---------|---------|-----------|------------|
| < 50    | 150     | 0         | 0          |
| 50–150  | 250     | 30        | 1500       |
| 150+    | 300     | 25        | 2500       |

**`resolvePacing(mode, lessonCount, custom?)`** returns a `PacingProfile`:
- `mode === "auto"` → pick tier from `AUTO_TIERS` based on `lessonCount`
- `mode === "turbo" | "balanced" | "safe"` → return `PRESETS[mode]`
- `mode === "custom"` → return `{ delayMs: custom.delayMs, batchSize: custom.batchSize, cooldownMs: 0 }`

### Storage (`utils/storage.ts`)

Replace current `delayItem` with:

```ts
modeItem:            "auto" | "turbo" | "balanced" | "safe" | "custom"  (default: "auto")
customDelayItem:     number  (default: 250, only read when mode === "custom")
customBatchSizeItem: number  (default: 30, only read when mode === "custom")
```

Remove: `DEFAULT_DELAY_MS`, `delayItem`.

No impossible states — `customDelayItem` and `customBatchSizeItem` only matter when `mode === "custom"`.

### Content Scripts

Both `reset-udemy-progress.ts` and `complete-udemy-progress.ts` change from:

```ts
(delayMs: number) => Promise<ScriptResult>
```

to:

```ts
(pacing: PacingProfile) => Promise<ScriptResult>
```

**Batching logic:** Inside the existing `for (const button of completeProgressButtons)` loop, after every `batchSize` clicks, `sleep(cooldownMs)` instead of `sleep(delayMs)`. If `batchSize === 0`, no batching — just use `delayMs` between every click.

**Progress reporting:** After each click, send a message via `browser.runtime.sendMessage`:

```ts
{ type: "progress", current: number, total: number }
```

Total is counted via `querySelectorAll` before the loop starts. `current` increments with each click.

### Popup (`entrypoints/popup/app.tsx`)

**Changes:**
1. Read `mode` (and custom values if needed) from storage
2. Count lessons is done inside content script; popup receives progress via messages
3. Register `browser.runtime.onMessage` listener on mount
4. Button text during progress changes from static "Resetting..." to dynamic "Resetting... 24/156"
5. Pass `PacingProfile` (resolved via `resolvePacing`) to content scripts instead of raw `delayMs`

### Options Page (`entrypoints/options/app.tsx`)

Full redesign. Three-layer progressive disclosure:

**Layer 1 — Auto (default):**
- Toggle ON at top of card
- Description: "Automatically adjusts speed based on course size"
- Presets and advanced are hidden

**Layer 2 — Presets (toggle Auto OFF):**
- Three radio-style cards: Turbo, Balanced (default selected), Safe
- Clean radio circle indicator, no emoji
- Selecting a preset saves `mode` to storage

**Layer 3 — Advanced (click "Advanced" below presets):**
- Two sliders: Action delay (50–1000ms), Batch size (5–50)
- Selecting Advanced sets `mode` to "custom"
- Switching back to a preset collapses Advanced

**Footer copy:** "Higher delay and smaller batch reduce the chance of unexpected logouts from Udemy."

**"Reset to Auto" button:** Visible when not in Auto mode. Switches back to Auto.

UI mockup: `docs/mockup-options.html`

## Migration

On first load after update, check if `modeItem` exists in storage:
- If not, read old `delayItem` value:
  - `50` (default) → `mode = "auto"`
  - `51–149` → `mode = "turbo"`
  - `150–300` → `mode = "balanced"`
  - `301+` → `mode = "safe"`
- Write `modeItem`, remove old `delayItem`

Migration runs in popup `onMount`.

## Files Changed

| File | Change |
|------|--------|
| `utils/pacing.ts` | **New.** `PRESETS`, `AUTO_TIERS`, `resolvePacing()`, `PacingProfile` type |
| `utils/storage.ts` | Replace `delayItem`/`DEFAULT_DELAY_MS` with `modeItem`, `customDelayItem`, `customBatchSizeItem`. Add migration function |
| `content-scripts/reset-udemy-progress.ts` | Accept `PacingProfile`, add batching + cooldown, send progress messages |
| `content-scripts/complete-udemy-progress.ts` | Same as reset script |
| `entrypoints/popup/app.tsx` | Resolve pacing, pass config to scripts, listen for progress, show counter |
| `entrypoints/options/app.tsx` | Full redesign: Auto toggle, preset cards, Advanced panel |

## Not In Scope

- No new browser permissions
- No background script changes
- No retry/verification logic (prevention only)
- No changes to popup layout, footer CTA, or branding

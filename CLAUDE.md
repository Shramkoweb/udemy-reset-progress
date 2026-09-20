# Udemy Reset Progress

MV3 browser extension (Chrome + Firefox) that clears or completes Udemy course
progress. WXT + SolidJS + Tailwind. No background script, no network calls, no
analytics — keep it that way.

- `entrypoints/popup/` — the popup: two action buttons, the review prompt
- `entrypoints/options/` — settings: speed mode, presets, custom sliders
- `content-scripts/` — the two functions injected into the Udemy page
- `utils/` — pacing profiles, review gating, storage and its migration

## Commands

```
pnpm dev                  # Chrome dev server
pnpm compile              # tsc --noEmit
pnpm test                 # unit + component (vitest, ~4s)
pnpm test:visual          # visual regression (playwright, ~5s incl. build)
pnpm test:all             # both, ~9s
pnpm test:visual:report   # expected / actual / diff for a failed run
```

## Working rules

**Run `pnpm test:all` after changes.** It takes nine seconds. Report which tests
failed before anything else — the list of failing visual tests is the answer to
"did I touch more than I meant to".

**Never run `pnpm test:visual:update` without being asked to.** A failing
screenshot is a finding, not an obstacle. Show the diff, say what moved, and let
the user decide whether it was intended. Updating a baseline means "I confirm
this change", and that is not yours to confirm.

**A new user-visible state needs a new screenshot.** Add `shot(root, "name")` to
the matching spec in `tests/visual/`, otherwise the state has no baseline and
will never catch a regression.

**Pin dependency versions exactly.** Every entry in `package.json` is an exact
version, no caret. `pnpm add` defaults to a caret — strip it.

## Traps

These cost real debugging time; do not rediscover them.

- **`onMount` races clicks.** The popup and the options page seed their signals
  from storage *after* first paint, so a click that lands before those reads
  settle is silently undone. Both suites have a `mount()` helper that waits —
  use it, never `render()` directly. Same problem in the visual harness, handled
  by `waitForSettled`.
- **Do not `await` pacing.** `recordSleeps()` in `tests/helpers/udemy-dom.ts`
  swaps in a `setTimeout` that records the delay and fires immediately. Assert on
  the recorded array.
- **States that time out need `freezeTimers: true`** in the visual harness — the
  `Done` flash, `Link copied!`, the `Saved` badge. It installs Playwright's fake
  clock. Do not use it on the options page's Advanced toggle: that path needs a
  real `requestAnimationFrame`.
- **Storage keys have two spellings.** `utils/storage.ts` uses WXT's `local:mode`;
  the raw `chrome.storage.local` seeded in the visual harness uses plain `mode`.
- **`.wxt/` is generated.** If `tsconfig.json` fails to resolve its `extends`,
  run `npx wxt prepare`. A `pnpm add` can wipe the directory.

## What the tests do not cover

The injected scripts are tested against a fake curriculum built from our own
selectors. If Udemy renames `data-purpose='progress-toggle-button'`, all 254
tests stay green and the extension is dead. Firefox rendering and real script
injection are not covered either. A manual run on a real course is still required
before publishing — say so rather than implying the suite is sufficient.

See [docs/testing.md](docs/testing.md) for the full picture.

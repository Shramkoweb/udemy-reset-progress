# Testing

Everything runs locally. Nothing here is wired to CI, and nothing reaches the
network — the visual tests serve the built extension off `127.0.0.1` and stub
the `chrome.*` APIs the pages talk to.

```
pnpm test                 # unit + component tests (vitest)
pnpm test:watch           # same, in watch mode
pnpm test:coverage        # same, with a coverage report in coverage/
pnpm test:visual          # visual regression (playwright, chromium)
pnpm test:visual:update   # accept the current rendering as the new baseline
pnpm test:visual:ui       # Playwright UI mode — step through and diff by hand
pnpm test:visual:report   # reopen the last HTML report
pnpm test:all             # both suites
```

## Unit and component tests

Vitest, jsdom, `@solidjs/testing-library`, and WXT's own `fakeBrowser`, so the
components run against a real in-memory `browser.storage` rather than a hand-rolled
double. Test files sit next to what they cover.

| File | Covers |
| --- | --- |
| `utils/pacing.test.ts` | preset table, every mode, the whole custom slider range |
| `utils/review.test.ts` | the gating rules, the dismiss lifecycle, every feedback destination |
| `utils/storage.test.ts` | defaults, browser detection, the delay-to-mode migration |
| `content-scripts/progress-scripts.test.ts` | both injected scripts against a fake curriculum |
| `entrypoints/popup/app.test.tsx` | the popup's whole state machine |
| `entrypoints/popup/review-prompt.test.tsx` | every step of the feedback flow |
| `entrypoints/options/app.test.tsx` | mode switching, presets, the advanced panel |

Two things to know before adding a test:

- **`onMount` races your clicks.** The popup and the options page both seed their
  signals from storage after the first paint, so a click that lands before those
  reads settle is silently undone. Both suites have a `mount()` helper that waits;
  use it.
- **Pacing is asserted, not waited on.** `recordSleeps()` in
  `tests/helpers/udemy-dom.ts` swaps in a `setTimeout` that records the requested
  delay and fires immediately, so the batching rules are checked in milliseconds.

Coverage sits at ~99% of statements. The gaps are the `if (busy()) return;` guard
in `handleRate` and the `isAnyInProgress()` guard in the popup — both are
belt-and-braces behind a `disabled` attribute, so the UI cannot reach them — plus
the `hasFeedbackForm()` false branches, which are dead while `FEEDBACK_FORM_ID`
is set.

## Visual regression

`pnpm test:visual` builds the extension, serves `.output/chrome-mv3` over a local
static server, and screenshots the real `popup.html` and `options.html` — the
production bundle, the real Tailwind output, the real markup. Only the `chrome.*`
APIs are stubbed (`tests/visual/harness.ts`), which is also how each screenshot
gets its state: seeded storage, a scripted answer from `scripting.executeScript`,
and clicks to drive the rest.

Baselines live in `tests/visual/__screenshots__/` and are committed. After an
intentional UI change:

```
pnpm test:visual            # see what moved
pnpm test:visual:report     # side-by-side expected / actual / diff
pnpm test:visual:update     # accept it
```

`pnpm test:visual:ui` is the one to reach for while iterating — it watches, reruns
and shows the diff without a round trip through the report.

Notes:

- Chromium only, by choice. Firefox-specific *wording* is covered by overriding
  the user agent (`tests/visual/review-prompt.visual.spec.ts`), which is all the
  extension branches on.
- States that time out on their own — the `Done` flash, `Link copied!`, the
  `Saved` badge — pass `freezeTimers: true`, which installs Playwright's fake
  clock so the timer never fires mid-screenshot. Don't use it on the options page's
  Advanced toggle: that path needs a real `requestAnimationFrame`.
- `SKIP_BUILD=1` skips the rebuild in `tests/visual/server.mjs` when the output is already current.
- Screenshots are taken of the app's own element, not `#root`, so the frame is the
  320px the user actually sees rather than the test viewport.

# Feedback form

The "something went wrong" branch of the review prompt opens this form. It has to
work for someone with no account and no patience, so: one screen, one required
question, everything else prefilled from the URL.

- **Live:** <https://tally.so/r/obJz2b>
- **Editor:** <https://tally.so/forms/obJz2b/edit>
- **Wired in:** `FEEDBACK_FORM_ID` in `utils/review.ts`

Built through the Tally API and published. Editing the copy is safe to do in the
Tally UI — only the field names below are a contract with the code.

---

## Field contract

The popup passes these as query parameters; the form receives them as hidden
fields. **The names are case-sensitive and must match `FEEDBACK_FIELDS` in
`utils/review.ts` exactly.** Rename one on either side and the value silently
stops arriving — nothing errors, the column just goes empty.

### `source` — where the report came from

`popup` for anything sent from the review prompt, `uninstall` for the exit
survey the browser opens when the extension is removed. Filter on this first:
the two populations answer completely different questions.

### `reason` — which chip they tapped

One of exactly four strings. The human label is sent rather than the internal key
(`not-working`, `rate-limited`, …) so the Tally table reads without a lookup:

| Value | Means |
|---|---|
| `Didn't work` | the run finished but progress did not change |
| `Slow / logged out` | rate limiting — Udemy throttled or dropped the session |
| `Missing a feature` | it worked, it just doesn't do the thing they wanted |
| `Something else` | the catch-all; read the comment |
| `Uninstalled` | not a chip — the exit survey, always paired with `source=uninstall` |

### `rating` — how annoyed they are

`bad` (😞) or `meh` (😐). **`great` never appears here** — 😍 is routed to the
store instead, which is the whole point of the gating. Use it to sort: a `bad`
plus a detailed comment is worth answering today.

### `comment` — what they typed in the popup

Raw textarea contents, trimmed, clamped to 500 characters. Can be empty, since
the popup does not require it.

### `version` — extension version at the time

From `browser.runtime.getManifest().version`, e.g. `2.0.1`. Lets you ignore
reports against a version you have already fixed, and shows at a glance whether
a release broke something.

### `browser` — which store they came from

`Chrome` or `Firefox`, derived from a `navigator.userAgent` check for "Firefox".
Edge, Brave, Opera and every other Chromium browser report as `Chrome` — they are
Chromium and their UA carries no Firefox marker. So `Chrome` means "not Firefox",
not literally Chrome.

### `mode` — the speed setting when it failed

The single most diagnostic field. One of:

| Value | Actual pacing | What a complaint means |
|---|---|---|
| `auto` | 250ms · batch 30 · cooldown 1500ms | the default — `auto` resolves to the *balanced* profile, not to anything adaptive |
| `turbo` | 100ms · no batching · no cooldown | prime suspect for `Slow / logged out`; this is the user outrunning Udemy, not a bug |
| `balanced` | 250ms · batch 30 · cooldown 1500ms | same numbers as `auto`, chosen deliberately |
| `safe` | 400ms · batch 20 · cooldown 3000ms | take seriously — the slowest profile failed too, so it is a real defect |
| `custom` | the user's own sliders | see the gap below |

**Known gap:** when `mode` is `custom` the actual delay and batch size are not
sent, so those reports are the hardest to act on. Adding `delay` and `batch`
parameters would close it — one more line in `buildFormUrl` plus two hidden
fields here.

### Visible questions

**What went wrong?** — required long answer, prefilled from `comment`. A
submission therefore carries both: `comment` is what they typed in the popup,
this answer is what they submitted after editing it on the form. When the two
differ, the difference is usually the most useful text in the whole report.

**Email, if you'd like a reply** — optional, and the only way this ever becomes a
conversation. The extension asks a given user exactly once: whatever they answer,
it never prompts them again. So if you want to turn a complaint around, the reply
has to come from you, by email — the product will not ask a second time.

Tally adds submission id, respondent id, timestamp and completed/partial status
on its own.

### Reading the table

- `Slow / logged out` + `turbo` → pacing, not a bug. Answer with Safe mode.
- `Didn't work` + `safe` → real defect, most likely Udemy changed its DOM.
- A cluster on one `version` → that release broke something.
- `source=uninstall` → read these separately; they are the only signal from
  people who already gave up on the extension.

## What the form contains

1. **Title** — "Help us fix it", submit button relabelled to "Send"
2. **Intro text** — one line thanking them for not just walking away
3. **Hidden fields** — the six above
4. **What went wrong?** — long answer, required, its default answer bound to the
   hidden field `comment`, so the user lands on a form already filled in (an
   uninstall report arrives with it empty, which is fine — that is the question
   you want them to answer anyway)
5. **Email, if you'd like a reply** — optional, placeholder "Leave it blank to
   stay anonymous."

Step 4 is the one that matters. Without that binding the user arrives at an empty
box and retypes what they already wrote in the popup — most of them won't.

The email field is what makes the re-arm logic worth anything: `rearm()` gives a
detractor one more prompt after a new version ships, and that only lands well if
they were told their report was acted on.

---

## Verifying it still works

Open this and check the long answer arrives filled in:

```
https://tally.so/r/obJz2b?reason=Didn%27t%20work&rating=bad&comment=Checkmarks%20come%20back%20after%20I%20reload%20the%20course%20page.&version=2.0.1&browser=Chrome&mode=turbo
```

Verified end to end on 2026-09-19: submitted through the live form, all six hidden
fields arrived with the right values, test submission deleted afterwards.

---

## Changing the destination

`FEEDBACK_FORM_ID` in `utils/review.ts` is the only place it lives. Point it at
another Tally form to swap; set it to an empty string and the code falls back to a
pre-filled GitHub issue, so the button is never a dead link.

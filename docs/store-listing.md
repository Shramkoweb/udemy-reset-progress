# Store listing

The single source for the Chrome Web Store and Firefox Add-ons listings. Paste
from here, edit here.

Every number below is checked against the code. Re-check them when shipping:
the speed ranges live in `entrypoints/options/app.tsx`, the presets in
`utils/pacing.ts`, and the packaged size is what `pnpm zip` prints.

---

## Extension name

Udemy Reset Progress — Reset & Complete Course Progress

## Short description (Chrome, 132 characters max)

Reset or complete Udemy course progress in one click. Smart pacing avoids logouts. Private, open source, actively maintained.

---

## Full description (Chrome Web Store)

**Reset or mark complete your Udemy course progress with one click.** No page reloads, no clicking through hundreds of lectures by hand.

### Why this extension?

Udemy has no built-in way to reset course progress. If you have finished a course and want to start fresh — for certification prep, a deeper second pass, or just a clean progress bar — you are stuck unchecking lectures one at a time.

Udemy Reset Progress does it in seconds.

### Features

**Clear Progress** — Resets every lecture completion checkmark across every section of the course. One click.

**Mark All Complete** — Marks every lecture as completed. Useful when you already know the material and want the certificate or a clean slate in the other direction.

**Smart pacing** — Large courses used to trigger unexpected logouts, because hundreds of rapid requests look like suspicious activity to Udemy. Pacing modes space the work out so that does not happen:

• Auto — picks a sensible speed for you. Recommended, and the default.
• Turbo — fastest, for small courses.
• Balanced — steady pace with a pause after every batch.
• Safe — slowest and most reliable, for courses with hundreds of lectures.
• Custom — set the delay (50–1000ms) and batch size (5–50) yourself; the cooldown between batches is derived from your delay.

**Lightweight** — Under 40 KB packaged. No background processes. Opens instantly.

**Private** — Zero data collection. Zero analytics. Zero network requests. Everything happens locally in your browser. The extension asks for three permissions and nothing more: activeTab and scripting to act on the course page you have open, and storage to remember your speed setting.

**Open source** — Full source under AGPL-3: https://github.com/Shramkoweb/udemy-reset-progress

**Cross-browser** — Chrome, Firefox and Edge.

**Actively maintained** — Regular updates as Udemy's interface changes. After a couple of successful runs the popup asks how things are going; if something is wrong, a short prefilled form takes the report straight to the developer. Nothing is sent unless you fill it in and submit it yourself.

### How to use

1. Open any Udemy course page (the curriculum or lecture view)
2. Click the extension icon in your toolbar
3. Choose "Clear Progress" to reset or "Mark All Complete" to finish
4. Done — the page updates as it goes

### Troubleshooting

- Make sure you are on a Udemy course page with the curriculum sidebar visible
- If progress does not reset, or you get logged out partway, open Settings (the gear icon) and switch to Safe mode. That gives Udemy more time to process each request
- On very large courses, Custom mode with a higher delay and a smaller batch is the most reliable combination

### Looking for a working Udemy progress reset tool?

Other reset extensions have not been updated in years and no longer work with Udemy's current interface. This one is actively maintained, open source, and trusted by 1,000+ users across Chrome and Firefox.

---

## Full description (Firefox Add-ons)

**Reset or mark complete your Udemy course progress with one click.**

Udemy has no native way to reset course progress. If you want to retake a course — for certification prep, review, or a fresh start — you would have to uncheck hundreds of lectures by hand.

This extension does it in seconds.

**Features:**
• Clear Progress — reset every lecture completion across every section
• Mark All Complete — mark every lecture as done in one click
• Smart pacing — Auto, Turbo, Balanced and Safe modes space the work out so large courses do not trigger unexpected logouts
• Custom mode — set the delay (50–1000ms) and batch size (5–50) yourself
• Under 40 KB packaged, no background processes
• Zero data collection, zero analytics, zero network requests
• Open source under AGPL-3: https://github.com/Shramkoweb/udemy-reset-progress

**How to use:**
1. Open a Udemy course page
2. Click the extension icon
3. Choose "Clear Progress" or "Mark All Complete"

**Having trouble?** Open Settings (the gear icon) and switch to Safe mode.

**Actively maintained** — regular updates, and the developer reads every report.

---

## Category

**Chrome:** Education

**Firefox:** Other

## Tags / keywords

udemy, reset progress, course progress, udemy reset, clear progress, restart course, udemy course, mark complete, complete course, reset udemy progress, udemy progress reset, restart udemy course, curriculum reset

## Search queries this listing targets

- "reset udemy progress"
- "udemy reset progress"
- "restart udemy course"
- "clear udemy course progress"
- "udemy progress reset extension"
- "reset course progress udemy"
- "mark udemy course complete"
- "complete udemy course progress"
- "udemy reset curriculum"
- "udemy start course over"

## SEO notes

1. **The title carries both actions** ("Reset & Complete") to catch both query clusters.
2. **"Actively maintained" and "working"** target people searching after finding dead competitors.
3. **"One click"** is the highest-converting phrase in this category.
4. **The troubleshooting section** picks up long-tail queries like "udemy reset progress not working".
5. **"1,000+ users"** is social proof — verify it against the store dashboards before each submission and raise it as it grows.
6. **No competitor names.** Chrome Web Store policy forbids naming them; the "other extensions have not been updated" phrasing stays compliant.
7. **The GitHub link** signals open-source credibility to technical users.
8. **Privacy wording is specific.** Naming the three permissions and what each is for heads off the most common one-star review, which is "why does it want access to my pages".

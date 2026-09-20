import { beforeEach, describe, expect, it } from "vitest";

import { completeUdemyProgress } from "./complete-udemy-progress";
import { resetUdemyProgress } from "./reset-udemy-progress";
import { addNonInputLesson, BALANCED, buildCurriculum, FAST, recordSleeps, TURBO } from "@/tests/helpers/udemy-dom";

type Script = typeof resetUdemyProgress;

const SCRIPTS: [name: string, run: Script, startsAs: boolean][] = [
  ["resetUdemyProgress", resetUdemyProgress, true],
  ["completeUdemyProgress", completeUdemyProgress, false],
];

beforeEach(() => {
  document.body.innerHTML = "";
});

describe.each(SCRIPTS)("%s", (_name, run, actionable) => {
  const untouched = !actionable;

  describe("page guards", () => {
    it("reports a missing curriculum when the page is not a course page", async () => {
      expect(await run(FAST)).toEqual({ success: false, error: "NO_CURRICULUM" });
    });

    it("reports missing sections when the curriculum renders no togglers", async () => {
      buildCurriculum([]);
      expect(await run(FAST)).toEqual({ success: false, error: "NO_SECTIONS" });
    });

    it("bails before touching any lesson when sections are missing", async () => {
      buildCurriculum([]);
      const orphan = document.createElement("div");
      orphan.setAttribute("data-purpose", "section-panel-0");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("data-purpose", "progress-toggle-button");
      input.checked = actionable;
      orphan.append(input);
      document.body.append(orphan);

      await run(FAST);
      expect(input.checked).toBe(actionable);
    });
  });

  describe("lesson toggling", () => {
    it("flips every lesson that needs flipping", async () => {
      const dom = buildCurriculum([{ lessons: [actionable, actionable, actionable] }]);
      const result = await run(FAST);

      expect(result).toEqual({ success: true, toggled: 3 });
      expect(dom.checkedStates()).toEqual([untouched, untouched, untouched]);
    });

    it("leaves lessons that are already in the target state alone", async () => {
      const dom = buildCurriculum([{ lessons: [untouched, untouched] }]);
      const result = await run(FAST);

      expect(result).toEqual({ success: true, toggled: 0 });
      expect(dom.checkedStates()).toEqual([untouched, untouched]);
    });

    it("flips only the lessons that are out of state in a mixed section", async () => {
      const dom = buildCurriculum([{ lessons: [actionable, untouched, actionable] }]);
      const result = await run(FAST);

      expect(result).toEqual({ success: true, toggled: 2 });
      expect(dom.checkedStates()).toEqual([untouched, untouched, untouched]);
    });

    it("ignores a progress toggle that is not a checkbox input", async () => {
      buildCurriculum([{ lessons: [] }]);
      const button = addNonInputLesson();
      let clicked = false;
      button.addEventListener("click", () => { clicked = true; });

      expect(await run(FAST)).toEqual({ success: true, toggled: 0 });
      expect(clicked).toBe(false);
    });

    it("walks every section panel on the page", async () => {
      const dom = buildCurriculum([
        { lessons: [actionable, actionable] },
        { lessons: [actionable] },
      ]);
      const result = await run(FAST);

      expect(result).toEqual({ success: true, toggled: 3 });
      expect(dom.checkedStates()).toEqual([untouched, untouched, untouched]);
    });

    it("does not pick up lessons that a section reveals mid-run", async () => {
      const dom = buildCurriculum([{ expanded: false, lessons: [actionable] }]);
      const lateInput = document.createElement("input");
      lateInput.type = "checkbox";
      lateInput.setAttribute("data-purpose", "progress-toggle-button");
      lateInput.checked = actionable;

      dom.container.querySelector("[data-css-toggle-id]")!.addEventListener("click", () => {
        const late = document.createElement("div");
        late.setAttribute("data-purpose", "section-panel-99");
        late.append(lateInput);
        document.body.append(late);
      }, { once: true });

      expect(await run(FAST)).toEqual({ success: true, toggled: 1 });
      expect(lateInput.checked).toBe(actionable);
      expect(dom.checkedStates()).toEqual([untouched]);
    });
  });

  describe("section togglers", () => {
    it("expands a collapsed section before working through it, then collapses it", async () => {
      const dom = buildCurriculum([{ expanded: false, lessons: [] }]);
      await run(FAST);
      expect(dom.togglerClicks).toEqual(["section-0", "section-0"]);
    });

    it("leaves an already expanded section alone until the closing click", async () => {
      const dom = buildCurriculum([{ expanded: true, lessons: [] }]);
      await run(FAST);
      expect(dom.togglerClicks).toEqual(["section-0"]);
    });

    it("treats a missing data-checked marker as collapsed", async () => {
      const dom = buildCurriculum([{ expanded: true, lessons: [] }]);
      dom.container.querySelector("[data-checked]")!.remove();

      await run(FAST);
      expect(dom.togglerClicks).toEqual(["section-0", "section-0"]);
    });

    it("skips clicking a toggler that is not an HTMLElement", async () => {
      const dom = buildCurriculum([{ expanded: false, svgToggler: true, lessons: [] }]);
      expect(await run(FAST)).toEqual({ success: true, toggled: 0 });
      expect(dom.togglerClicks).toEqual([]);
    });

    it("handles every section in document order", async () => {
      const dom = buildCurriculum([
        { expanded: false, lessons: [] },
        { expanded: true, lessons: [] },
      ]);
      await run(FAST);
      expect(dom.togglerClicks).toEqual(["section-0", "section-0", "section-1"]);
    });
  });

  describe("pacing", () => {
    it("sleeps the configured delay after expanding a collapsed section", async () => {
      buildCurriculum([{ expanded: false, lessons: [] }]);
      const sleeps = recordSleeps();

      await run({ delayMs: 42, batchSize: 0, cooldownMs: 999 });
      expect(sleeps).toEqual([42]);
    });

    it("never sleeps when there is nothing to expand or flip", async () => {
      buildCurriculum([{ expanded: true, lessons: [untouched] }]);
      const sleeps = recordSleeps();

      await run(TURBO);
      expect(sleeps).toEqual([]);
    });

    it("sleeps the plain delay between lessons when batching is off", async () => {
      buildCurriculum([{ lessons: Array(4).fill(actionable) }]);
      const sleeps = recordSleeps();

      await run({ delayMs: 100, batchSize: 0, cooldownMs: 5000 });
      expect(sleeps).toEqual([100, 100, 100, 100]);
    });

    it("swaps in the cooldown at every batch boundary", async () => {
      buildCurriculum([{ lessons: Array(5).fill(actionable) }]);
      const sleeps = recordSleeps();

      await run({ delayMs: 10, batchSize: 2, cooldownMs: 700 });
      expect(sleeps).toEqual([10, 700, 10, 700, 10]);
    });

    it("counts batches across sections, not per section", async () => {
      buildCurriculum([
        { lessons: [actionable, actionable] },
        { lessons: [actionable, actionable] },
      ]);
      const sleeps = recordSleeps();

      await run({ delayMs: 10, batchSize: 3, cooldownMs: 700 });
      expect(sleeps).toEqual([10, 10, 700, 10]);
    });

    it("treats a negative batch size as batching off", async () => {
      buildCurriculum([{ lessons: [actionable, actionable] }]);
      const sleeps = recordSleeps();

      await run({ delayMs: 10, batchSize: -5, cooldownMs: 700 });
      expect(sleeps).toEqual([10, 10]);
    });

    it("applies the real balanced preset without cooling down early", async () => {
      buildCurriculum([{ lessons: Array(3).fill(actionable) }]);
      const sleeps = recordSleeps();

      await run(BALANCED);
      expect(sleeps).toEqual([250, 250, 250]);
    });
  });
});

describe("direction", () => {
  it("resetUdemyProgress only unchecks", async () => {
    const dom = buildCurriculum([{ lessons: [true, false, true] }]);
    expect(await resetUdemyProgress(FAST)).toEqual({ success: true, toggled: 2 });
    expect(dom.checkedStates()).toEqual([false, false, false]);
  });

  it("completeUdemyProgress only checks", async () => {
    const dom = buildCurriculum([{ lessons: [true, false, true] }]);
    expect(await completeUdemyProgress(FAST)).toEqual({ success: true, toggled: 1 });
    expect(dom.checkedStates()).toEqual([true, true, true]);
  });

  it("round-trips a course back to where it started", async () => {
    const dom = buildCurriculum([{ lessons: [true, true, true] }]);
    await resetUdemyProgress(FAST);
    expect(dom.checkedStates()).toEqual([false, false, false]);

    await completeUdemyProgress(FAST);
    expect(dom.checkedStates()).toEqual([true, true, true]);
  });
});

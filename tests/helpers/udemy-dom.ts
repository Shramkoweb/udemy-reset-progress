import { vi } from "vitest";

export type SectionSpec = {
  expanded?: boolean;
  lessons?: boolean[];
  svgToggler?: boolean;
};

export type Curriculum = {
  container: HTMLElement;
  togglerClicks: string[];
  lessonInputs: HTMLInputElement[];
  checkedStates: () => boolean[];
};

export function buildCurriculum(sections: SectionSpec[]): Curriculum {
  const container = document.createElement("div");
  container.setAttribute("data-purpose", "curriculum-section-container");

  const togglerClicks: string[] = [];
  const lessonInputs: HTMLInputElement[] = [];

  sections.forEach((spec, sectionIndex) => {
    const { expanded = true, lessons = [], svgToggler = false } = spec;
    const wrapper = document.createElement("div");

    const marker = document.createElement("span");
    marker.setAttribute("data-checked", expanded ? "checked" : "unchecked");
    wrapper.append(marker);

    const toggler = svgToggler
      ? document.createElementNS("http://www.w3.org/2000/svg", "svg")
      : document.createElement("div");
    toggler.setAttribute("data-css-toggle-id", `section-${sectionIndex}`);
    toggler.addEventListener("click", () => togglerClicks.push(`section-${sectionIndex}`));
    wrapper.append(toggler);

    const panel = document.createElement("div");
    panel.setAttribute("data-purpose", `section-panel-${sectionIndex}`);
    lessons.forEach((checked) => {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("data-purpose", "progress-toggle-button");
      input.checked = checked;
      panel.append(input);
      lessonInputs.push(input);
    });
    wrapper.append(panel);

    container.append(wrapper);
  });

  document.body.append(container);

  return {
    container,
    togglerClicks,
    lessonInputs,
    checkedStates: () => lessonInputs.map((input) => input.checked),
  };
}

export function addNonInputLesson(panelIndex = 0): HTMLElement {
  const panel = document.querySelector(`[data-purpose='section-panel-${panelIndex}']`)!;
  const button = document.createElement("button");
  button.setAttribute("data-purpose", "progress-toggle-button");
  panel.append(button);
  return button;
}

/** Records each requested delay and fires immediately, so pacing costs no wall-clock time. */
export function recordSleeps(): number[] {
  const delays: number[] = [];
  const real = globalThis.setTimeout;
  vi.stubGlobal("setTimeout", ((fn: () => void, ms?: number) => {
    delays.push(ms ?? 0);
    return real(fn, 0);
  }) as unknown as typeof setTimeout);
  return delays;
}

export const TURBO = { delayMs: 100, batchSize: 0, cooldownMs: 0 };
export const BALANCED = { delayMs: 250, batchSize: 30, cooldownMs: 1500 };
export const FAST = { delayMs: 0, batchSize: 0, cooldownMs: 0 };

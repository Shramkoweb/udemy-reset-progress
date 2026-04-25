export type CompleteResult = {
  success: true;
  toggled: number;
} | {
  success: false;
  error: "NO_CURRICULUM" | "NO_SECTIONS";
};

export const completeUdemyProgress = async (delayMs: number = 50): Promise<CompleteResult> => {
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

  for (const toggler of sectionToggles) {
    const previousElement = toggler.previousElementSibling;
    const isTogglerChecked = previousElement?.getAttribute(SELECTOR.CHECKED_ATTR) === "checked";

    if (!isTogglerChecked && toggler instanceof HTMLElement) {
      toggler.click();
      await sleep(delayMs);
    }

    for (const lesson of lessons) {
      const completeProgressButtons = lesson.querySelectorAll(SELECTOR.LESSON_TOGGLE);

      for (const button of completeProgressButtons) {
        if (button instanceof HTMLInputElement && !button.checked) {
          button.click();
          toggled++;
          await sleep(delayMs);
        }
      }
    }

    if (toggler instanceof HTMLElement) {
      toggler.click();
    }
  }

  return { success: true, toggled };
};

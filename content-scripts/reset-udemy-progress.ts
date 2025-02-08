export const resetUdemyProgress = async (): Promise<void> => {
  const SELECTOR = {
    SECTION_CONTAINER: "[data-purpose='curriculum-section-container']",
    SECTION_TOGGLE: "[data-css-toggle-id]",
    CHECKED_ATTR: "data-checked",
    LESSON_CONTAINER: "[data-purpose^='section-panel-']",
    LESSON_TOGGLE: "[data-purpose='progress-toggle-button']"
  } as const;
  const DELAY_MS = 50;

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    const section = document.querySelector(SELECTOR.SECTION_CONTAINER);
    const sectionToggles = section?.querySelectorAll(SELECTOR.SECTION_TOGGLE);
    const lessons = document.querySelectorAll(SELECTOR.LESSON_CONTAINER);

    if (sectionToggles && sectionToggles.length !== 0) {
      for (const toggler of sectionToggles) {
        const previousElement = toggler.previousElementSibling;
        const isTogglerChecked = previousElement?.getAttribute(SELECTOR.CHECKED_ATTR) === 'checked';

        if (!isTogglerChecked && toggler instanceof HTMLElement) {
          toggler.click();
          await sleep(DELAY_MS);
        }

        for (const lesson of lessons) {
          const completeProgressButtons = lesson.querySelectorAll(SELECTOR.LESSON_TOGGLE);

          for (const button of completeProgressButtons) {
            if (button instanceof HTMLInputElement && button.checked) {
              button.click();
              await sleep(DELAY_MS);
            }
          }
        }

        if (toggler instanceof HTMLElement) {
          toggler?.click()
        }
      }
    }
  } catch (error) {
    console.error('Error resetting curriculum progress:', error);
    throw error;
  }
}

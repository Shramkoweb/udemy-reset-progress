import { expect, test, type Page } from "@playwright/test";

import { armedForReview, openPopup, openedUrls, shot } from "./harness";

const FIREFOX_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0";

async function openPrompt(page: Page) {
  const root = await openPopup(page, { storage: armedForReview(), freezeTimers: true });
  await page.getByRole("button", { name: "Clear Udemy progress" }).click();
  await expect(page.getByText("How's Udemy Reset Progress working for you?")).toBeVisible();
  return root;
}

test.describe("the review prompt", () => {
  test("asks the question", async ({ page }) => {
    await shot(await openPrompt(page), "ask");
  });

  test("pitches a store review to a happy user", async ({ page }) => {
    const root = await openPrompt(page);
    await page.getByRole("button", { name: "Great" }).click();

    await expect(page.getByRole("button", { name: "Rate on Chrome Web Store" })).toBeVisible();
    await shot(root, "promote-chrome");
  });

  test("thanks a user who went to rate it", async ({ page }) => {
    const root = await openPrompt(page);
    await page.getByRole("button", { name: "Great" }).click();
    await page.getByRole("button", { name: "Rate on Chrome Web Store" }).click();

    await expect(page.getByText("Thanks — that really helps.")).toBeVisible();
    expect(await openedUrls(page)).toEqual([
      "https://chromewebstore.google.com/detail/udemy-reset-progress/dddnklikfgdefjekcbhehjogkpfkbdlo/reviews",
    ]);
    await shot(root, "thanks");
  });

  test("asks what went wrong, before a reason is picked", async ({ page }) => {
    const root = await openPrompt(page);
    await page.getByRole("button", { name: "Bad" }).click();

    await expect(page.getByText("Sorry about that. What went wrong?")).toBeVisible();
    await shot(root, "improve-no-reason");
  });

  test("opens the comment box once a reason is picked", async ({ page }) => {
    const root = await openPrompt(page);
    await page.getByRole("button", { name: "Okay" }).click();
    await page.getByRole("button", { name: "Slow / logged out" }).click();

    await expect(page.getByPlaceholder("Anything else? (optional)")).toBeVisible();
    await shot(root, "improve-reason-picked");
  });

  test("holds a written-out complaint", async ({ page }) => {
    const root = await openPrompt(page);
    await page.getByRole("button", { name: "Bad" }).click();
    await page.getByRole("button", { name: "Didn't work" }).click();
    await page.getByPlaceholder("Anything else? (optional)")
      .fill("Nothing happens when I press Clear Progress on a course with 400 lectures.");

    await shot(root, "improve-with-comment");
  });

  test("sends the report to the pre-filled form", async ({ page }) => {
    await openPrompt(page);
    await page.getByRole("button", { name: "Bad" }).click();
    await page.getByRole("button", { name: "Missing a feature" }).click();
    await page.getByPlaceholder("Anything else? (optional)").fill("Per-section reset would help");
    await page.getByRole("button", { name: "Send feedback" }).click();

    await expect(page.getByText("Thanks — that really helps.")).toBeVisible();
    const url = new URL((await openedUrls(page))[0]!);
    expect(url.origin + url.pathname).toBe("https://tally.so/r/obJz2b");
    expect(url.searchParams.get("rating")).toBe("bad");
    expect(url.searchParams.get("reason")).toBe("Missing a feature");
    expect(url.searchParams.get("comment")).toBe("Per-section reset would help");
    expect(url.searchParams.get("version")).toBe("2.1.0");
  });

  test("closes without a trace when dismissed", async ({ page }) => {
    const root = await openPrompt(page);
    await page.getByRole("button", { name: "Not now" }).click();

    await expect(page.getByText("How's Udemy Reset Progress working for you?")).toBeHidden();
    await shot(root, "dismissed");
  });
});

test.describe("the review prompt on Firefox", () => {
  test.use({ userAgent: FIREFOX_UA });

  test("names the Firefox store", async ({ page }) => {
    const root = await openPrompt(page);
    await page.getByRole("button", { name: "Great" }).click();

    await expect(page.getByRole("button", { name: "Rate on Firefox Add-ons" })).toBeVisible();
    await shot(root, "promote-firefox");
  });

  test("sends a Firefox user to the add-on review page", async ({ page }) => {
    await openPrompt(page);
    await page.getByRole("button", { name: "Great" }).click();
    await page.getByRole("button", { name: "Rate on Firefox Add-ons" }).click();

    await expect(page.getByText("Thanks — that really helps.")).toBeVisible();
    expect(await openedUrls(page)).toEqual([
      "https://addons.mozilla.org/en-US/firefox/addon/udemy-reset-progress/reviews/",
    ]);
  });
});

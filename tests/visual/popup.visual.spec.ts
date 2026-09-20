import { expect, test } from "@playwright/test";

import { armedForReview, openPopup, openedUrls, shot } from "./harness";

const CLEAR = "Clear Udemy progress";
const COMPLETE = "Mark all lessons as complete";

test.describe("popup", () => {
  test("resting state on a fresh install", async ({ page }) => {
    const root = await openPopup(page);
    await expect(page.getByRole("button", { name: CLEAR })).toHaveText("Clear Progress");
    await shot(root, "resting");
  });

  test("resting state once the user is invested", async ({ page }) => {
    const root = await openPopup(page, { storage: { successCount: 3 } });
    await expect(page.getByRole("button", { name: "Share with a friend" })).toBeVisible();
    await shot(root, "resting-with-share");
  });

  test("resting state after the user already answered the prompt", async ({ page }) => {
    const root = await openPopup(page, {
      storage: {
        successCount: 12,
        reviewState: { stage: "rated", firstSuccessAt: 1, snoozeUntil: 0, promptCount: 1, lastSentiment: "great" },
      },
    });
    await expect(page.getByRole("link", { name: "shramko.dev" })).toBeVisible();
    await shot(root, "resting-after-review");
  });

  test("clear progress in flight", async ({ page }) => {
    const root = await openPopup(page, { script: { kind: "hang" } });
    await page.getByRole("button", { name: CLEAR }).click();

    await expect(page.getByRole("button", { name: CLEAR })).toHaveText("Resetting...");
    await expect(page.getByRole("button", { name: COMPLETE })).toBeDisabled();
    await shot(root, "clear-in-progress");
  });

  test("mark all complete in flight", async ({ page }) => {
    const root = await openPopup(page, { script: { kind: "hang" } });
    await page.getByRole("button", { name: COMPLETE }).click();

    await expect(page.getByRole("button", { name: COMPLETE })).toHaveText("Completing...");
    await shot(root, "complete-in-progress");
  });

  test("clear progress done", async ({ page }) => {
    const root = await openPopup(page, { script: { kind: "success", toggled: 42 }, freezeTimers: true });
    await page.getByRole("button", { name: CLEAR }).click();

    await expect(page.getByRole("button", { name: CLEAR })).toHaveText("Done");
    await shot(root, "clear-done");
  });

  test("mark all complete done", async ({ page }) => {
    const root = await openPopup(page, { script: { kind: "success", toggled: 42 }, freezeTimers: true });
    await page.getByRole("button", { name: COMPLETE }).click();

    await expect(page.getByRole("button", { name: COMPLETE })).toHaveText("Done");
    await shot(root, "complete-done");
  });

  test("not a course page", async ({ page }) => {
    const root = await openPopup(page, { script: { kind: "failure", error: "NO_CURRICULUM" }, freezeTimers: true });
    await page.getByRole("button", { name: CLEAR }).click();

    await expect(page.getByText("Open a Udemy course page first")).toBeVisible();
    await shot(root, "error-no-curriculum");
  });

  test("a course page with no sections", async ({ page }) => {
    const root = await openPopup(page, { script: { kind: "failure", error: "NO_SECTIONS" }, freezeTimers: true });
    await page.getByRole("button", { name: COMPLETE }).click();

    await expect(page.getByText("No course sections found on this page")).toBeVisible();
    await shot(root, "error-no-sections");
  });

  test("an error code the popup does not recognise", async ({ page }) => {
    const root = await openPopup(page, { script: { kind: "failure", error: "SOMETHING_NEW" }, freezeTimers: true });
    await page.getByRole("button", { name: CLEAR }).click();

    await expect(page.getByText("Something went wrong")).toBeVisible();
    await shot(root, "error-unknown");
  });

  test("no tab to inject into", async ({ page }) => {
    const root = await openPopup(page, { noTab: true, freezeTimers: true });
    await page.getByRole("button", { name: CLEAR }).click();

    await expect(page.getByText("Cannot access the current tab")).toBeVisible();
    await shot(root, "error-no-tab");
  });

  test("injection refused by the page", async ({ page }) => {
    const root = await openPopup(page, { script: { kind: "throw" }, freezeTimers: true });
    await page.getByRole("button", { name: CLEAR }).click();

    await expect(page.getByText("Make sure you're on a Udemy page")).toBeVisible();
    await shot(root, "error-injection-refused");
  });

  test("share link copied", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const root = await openPopup(page, { storage: { successCount: 5 }, freezeTimers: true });
    await page.getByRole("button", { name: "Share with a friend" }).click();

    await expect(page.getByRole("button", { name: "Link copied!" })).toBeVisible();
    await shot(root, "share-copied");
  });

  test("the settings page is one click away", async ({ page }) => {
    await openPopup(page);
    await page.getByRole("button", { name: "Settings" }).click();
    expect(await openedUrls(page)).toEqual(["options"]);
  });

  test("the review prompt opens on an eligible successful run", async ({ page }) => {
    const root = await openPopup(page, { storage: armedForReview() });
    await page.getByRole("button", { name: CLEAR }).click();

    await expect(page.getByText("How's Udemy Reset Progress working for you?")).toBeVisible();
    await shot(root, "review-prompt-open");
  });
});

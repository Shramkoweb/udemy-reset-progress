import { expect, test, type Page } from "@playwright/test";

import { openOptions, shot } from "./harness";

const preset = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}`) });
const advanced = (page: Page) => page.getByRole("button", { name: /^Advanced/ });

test.describe("settings", () => {
  test("auto mode, with the presets tucked away", async ({ page }) => {
    const root = await openOptions(page);
    await expect(page.getByText(/Automatically adjusts speed/)).toBeVisible();
    await shot(root, "auto");
  });

  test.describe("the presets", () => {
    for (const [mode, name] of [["turbo", "Turbo"], ["balanced", "Balanced"], ["safe", "Safe"]] as const) {
      test(`${mode} selected`, async ({ page }) => {
        const root = await openOptions(page, { storage: { mode } });
        await expect(preset(page, name)).toBeVisible();
        await shot(root, `preset-${mode}`);
      });
    }
  });

  test("the advanced panel at its saved values", async ({ page }) => {
    const root = await openOptions(page, {
      storage: { mode: "custom", customDelay: 500, customBatchSize: 25 },
    });
    await expect(page.getByText("500ms")).toBeVisible();
    await shot(root, "custom-mid");
  });

  test("the advanced panel at the fastest end of both sliders", async ({ page }) => {
    const root = await openOptions(page, {
      storage: { mode: "custom", customDelay: 50, customBatchSize: 5 },
    });
    await expect(page.getByRole("slider").first()).toHaveValue("50");
    await shot(root, "custom-min");
  });

  test("the advanced panel at the safest end of both sliders", async ({ page }) => {
    const root = await openOptions(page, {
      storage: { mode: "custom", customDelay: 1000, customBatchSize: 50 },
    });
    await expect(page.getByRole("slider").first()).toHaveValue("1000");
    await shot(root, "custom-max");
  });

  test("turning Auto off reveals the presets on Balanced", async ({ page }) => {
    const root = await openOptions(page);
    await page.getByText("Auto", { exact: true }).click();

    await expect(preset(page, "Balanced")).toBeVisible();
    await shot(root, "auto-turned-off");
  });

  test("opening Advanced switches the mode to custom", async ({ page }) => {
    const root = await openOptions(page, { storage: { mode: "balanced" } });
    await advanced(page).click();

    await expect(page.getByText("Action delay")).toBeVisible();
    await expect(page.getByText("250ms")).toBeVisible();
    await shot(root, "advanced-just-opened");
  });

  test("closing Advanced falls back to Balanced", async ({ page }) => {
    const root = await openOptions(page, { storage: { mode: "custom", customDelay: 400, customBatchSize: 20 } });
    await expect(page.getByText("Action delay")).toBeVisible();

    await advanced(page).click();
    await expect(page.getByText("Action delay")).toBeHidden();
    await shot(root, "advanced-closed");
  });

  test("Reset to Auto puts everything back", async ({ page }) => {
    const root = await openOptions(page, { storage: { mode: "custom", customDelay: 400, customBatchSize: 20 } });
    await page.getByRole("button", { name: "Reset to Auto" }).click();

    await expect(page.getByText(/Automatically adjusts speed/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset to Auto" })).toBeHidden();
    await shot(root, "reset-to-auto");
  });

  test("the Auto switch is reachable and operable from the keyboard", async ({ page }) => {
    await openOptions(page);
    const auto = page.getByRole("switch", { name: "Auto speed mode" });
    await expect(auto).toHaveAttribute("aria-checked", "true");

    await auto.focus();
    await expect(auto).toBeFocused();
    await page.keyboard.press("Space");

    await expect(auto).toHaveAttribute("aria-checked", "false");
    await expect(preset(page, "Balanced")).toBeVisible();
  });

  test("both outbound links are safe to open in a new tab", async ({ page }) => {
    await openOptions(page);
    for (const name of [/Rate/, "Send feedback"]) {
      const link = page.getByRole("link", { name });
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  test("the Saved badge confirms a change", async ({ page }) => {
    const root = await openOptions(page, { storage: { mode: "balanced" }, freezeTimers: true });
    await preset(page, "Safe").click();

    await expect(page.getByText("Saved")).toHaveClass(/opacity-100/);
    await shot(root, "saved-badge");
  });

  test("dragging the delay slider repaints its track and saves", async ({ page }) => {
    const root = await openOptions(page, {
      storage: { mode: "custom", customDelay: 250, customBatchSize: 30 }, freezeTimers: true,
    });
    await page.getByRole("slider").first().fill("850");

    await expect(page.getByText("850ms")).toBeVisible();
    await shot(root, "custom-after-drag");
  });
});

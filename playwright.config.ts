import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.VISUAL_PORT ?? 4319);

export default defineConfig({
  testDir: "./tests/visual",
  testMatch: "**/*.visual.spec.ts",
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFileName}/{arg}{ext}",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : undefined,
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }], ["list"]],

  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      maxDiffPixelRatio: 0.002,
    },
  },

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 420, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    trace: "retain-on-failure",
  },

  projects: [{
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      viewport: { width: 420, height: 720 },
      deviceScaleFactor: 1,
    },
  }],

  webServer: {
    command: "node tests/visual/server.mjs",
    url: `http://127.0.0.1:${PORT}/popup.html`,
    reuseExistingServer: false,
    stdout: "ignore",
  },
});

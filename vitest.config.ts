import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid(), WxtVitest()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".output/**", ".wxt/**", "tests/visual/**"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "html"],
      include: ["utils/**/*.ts", "content-scripts/**/*.ts", "entrypoints/**/*.tsx"],
      exclude: ["**/*.test.*", "entrypoints/**/main.tsx"],
    },
  },
});

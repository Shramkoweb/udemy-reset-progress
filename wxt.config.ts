import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: "chrome",
  manifest: {
    permissions: ["scripting", "activeTab"],
  },
  modules: ["@wxt-dev/module-solid"],
});

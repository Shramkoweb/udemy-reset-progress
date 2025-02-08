import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: "chrome",
  manifest: {
    name: "Udemy Reset Progress",
    permissions: ["scripting", "activeTab"],
  },
  modules: ["@wxt-dev/module-solid"],
});

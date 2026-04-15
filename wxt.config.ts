import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: "Udemy Reset Progress",
    permissions: ["scripting", "activeTab", "storage"],
  },
  modules: ["@wxt-dev/module-solid"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});

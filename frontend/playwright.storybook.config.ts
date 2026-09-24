import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "storybook.spec.ts",
  use: { baseURL: "http://127.0.0.1:6006" },
  webServer: {
    command: "npm run storybook -- --ci --no-open",
    url: "http://127.0.0.1:6006/iframe.html",
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
});

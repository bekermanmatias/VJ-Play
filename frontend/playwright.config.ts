import { defineConfig, devices } from "@playwright/test";

const liveUrl = process.env.VJ_QA_BASE_URL;
export default defineConfig({
  testDir: "./tests",
  testIgnore: "storybook.spec.ts",
  timeout: 30_000,
  use: { ...devices["Desktop Chrome"], baseURL: liveUrl ?? "http://127.0.0.1:4322" },
  webServer: liveUrl ? undefined : {
    command: "npm run dev -- --host 127.0.0.1 --port 4322",
    url: "http://127.0.0.1:4322/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    ignoreHTTPSErrors: true,
  },
});

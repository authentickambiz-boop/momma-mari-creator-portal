import { defineConfig, devices } from "@playwright/test";

const port = 43124;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: `npx next dev --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/worlds/city/smoke`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      WORLDS_CITY: "true",
      WORLDS_CITY_SMOKE: "true",
    },
  },
});

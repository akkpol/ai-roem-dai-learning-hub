import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.IDENTITY_E2E_BASE_URL ?? "http://127.0.0.1:3000";
const adminStorageState =
  process.env.IDENTITY_E2E_ADMIN_STORAGE_STATE || undefined;
const supportStorageState =
  process.env.IDENTITY_E2E_SUPPORT_STORAGE_STATE || undefined;
const providerBrowserGate = process.env.ORGANIZATION_E2E_PROVIDER_GATE === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: providerBrowserGate ? 0 : process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: providerBrowserGate ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: providerBrowserGate ? "off" : "retain-on-failure",
  },
  projects: [
    {
      name: "identity-admin-desktop",
      use: {
        ...devices["Desktop Chrome"],
        storageState: adminStorageState,
      },
    },
    {
      name: "identity-admin-mobile",
      use: {
        ...devices["Pixel 7"],
        storageState: adminStorageState,
      },
    },
    {
      name: "identity-support-desktop",
      use: {
        ...devices["Desktop Chrome"],
        storageState: supportStorageState,
      },
    },
  ],
  outputDir: "test-results/playwright",
});

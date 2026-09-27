import product from "../../package.json";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/__tests__/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", {open:"never"}]],
  use: { baseURL:"http://127.0.0.1:4318", trace:"retain-on-failure", screenshot:"only-on-failure", launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {} },
  projects: [{name:"chromium",use:{...devices["Desktop Chrome"]}}],
  webServer: {
    command:`node ../../release/${product.name}-${product.version}/runtime/start.mjs`,
    url:"http://127.0.0.1:4318",
    reuseExistingServer:false,
    timeout:30_000,
    env:{TUTOR_ANTHROPIC_KEY:"",TUTOR_MODEL:""},
  },
});

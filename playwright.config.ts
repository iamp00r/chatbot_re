import { defineConfig, devices } from "@playwright/test";

import { FAKE_SUPABASE_URL } from "./tests/e2e/support/session";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // 이미 설치된 Chromium을 쓰고 싶을 때만 지정 (보통은 비워 둔다)
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : undefined,
      },
    },
  ],
  webServer: [
    // 가짜 Supabase(Auth·REST 일부). 로그인 이후 흐름을 실제 Supabase 없이 검사한다.
    {
      command: `node tests/e2e/support/fake-supabase.mjs`,
      url: `${FAKE_SUPABASE_URL}/health`,
      reuseExistingServer: !process.env.CI,
    },
    // 프로덕션 빌드로 띄워서 테스트한다 (CI와 같은 조건).
    // NEXT_PUBLIC_* 는 빌드 때 코드에 박히므로 가짜 Supabase 주소로 빌드한다. .env.local보다 우선한다.
    {
      command: `pnpm build && pnpm start --port ${PORT}`,
      url: `${baseURL}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: FAKE_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "fake-anon-key",
      },
    },
  ],
});

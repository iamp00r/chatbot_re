import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { signInAs } from "./support/session";

test.describe("로그인하지 않은 사용자", () => {
  test("홈에 오면 /login으로 보낸다", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Loom" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Google로 계속하기" })).toBeVisible();
    await expect(page.getByLabel("이메일")).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인 링크 받기" })).toBeVisible();
  });

  test("다른 화면은 돌아올 주소(next)를 붙여 보낸다", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/login\?next=%2Fonboarding$/);
  });

  test("API는 이동 대신 401을 준다", async ({ request }) => {
    const res = await request.get("/api/something", { maxRedirects: 0 });
    expect(res.status()).toBe(401);
  });

  test("/api/health는 인증 없이 열린다", async ({ request }) => {
    const res = await request.get("/api/health", { maxRedirects: 0 });
    expect([200, 503]).toContain(res.status());
  });

  test("로그인 실패 표시", async ({ page }) => {
    await page.goto("/login?error=callback");
    await expect(page.getByText(/^로그인을 끝내지 못했습니다/)).toBeVisible();
  });

  test("콜백에 코드가 없으면 로그인 화면으로 돌려보낸다", async ({ request }) => {
    const res = await request.get("/auth/callback?next=//evil.example", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toMatch(/\/login\?error=callback$/);
  });
});

test.describe("로그인한 사용자", () => {
  test("첫 로그인 → 닉네임 입력 → 홈 → 로그아웃", async ({ page, context, baseURL }) => {
    await signInAs(context, baseURL!, {
      id: randomUUID(),
      email: "tester@example.com",
      name: "테스트 사용자",
    });

    // 프로필이 없으므로 온보딩으로
    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding$/);
    const nickname = page.getByLabel("닉네임");
    await expect(nickname).toHaveValue("테스트 사용자"); // Google 이름으로 미리 채움

    // 빈 값은 거절
    await nickname.fill("   ");
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page.getByText("닉네임을 입력하세요.")).toBeVisible();

    await nickname.fill("  하늘  ");
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("하늘님, 반가워요.")).toBeVisible();

    // 프로필이 생긴 뒤에는 온보딩·로그인 화면이 홈으로 보낸다
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("서명이 틀린 토큰은 로그인으로 인정하지 않는다", async ({ page, context, baseURL }) => {
    await signInAs(context, baseURL!, { id: randomUUID(), email: "x@example.com" });
    const [cookie] = await context.cookies();
    const session = JSON.parse(
      Buffer.from(cookie.value.replace(/^base64-/, ""), "base64url").toString("utf8"),
    );
    session.access_token = session.access_token.replace(/fake-signature$/, "forged");
    await context.clearCookies();
    await context.addCookies([
      {
        ...cookie,
        value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
      },
    ]);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
});

import { expect, test } from "@playwright/test";

test("홈 화면이 열린다", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Loom");
  await expect(page.getByRole("heading", { level: 1, name: "Loom" })).toBeVisible();
});

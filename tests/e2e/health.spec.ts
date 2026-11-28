import { expect, test } from "@playwright/test";

// CI·로컬 E2E에는 DB가 없으므로 503(db: down)이 정상이다.
// 빌드 때 미리 렌더링되지 않고 요청마다 실행되는지도 함께 확인된다.
test("/api/health가 JSON으로 상태를 알려 준다", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.headers()["cache-control"]).toContain("no-store");
  const body = await res.json();
  if (process.env.DATABASE_URL) {
    expect(res.status()).toBe(200);
    expect(body).toEqual({ ok: true, db: "up" });
  } else {
    expect(res.status()).toBe(503);
    expect(body).toEqual({ ok: false, db: "down" });
  }
});

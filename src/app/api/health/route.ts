import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/lib/db/client";

/**
 * 헬스 체크: 앱이 떠 있고 DB에 닿는지 확인한다.
 * - 배포 확인용(Vercel 주소/api/health)
 * - Supabase 무료 플랜 일시정지(7일 무요청) 방지: GitHub Actions `keepalive`가 주기적으로 호출한다.
 * 응답에 비밀값이나 오류 원문을 담지 않는다.
 */
export async function GET() {
  // Cache Components에서는 GET도 빌드 때 미리 렌더링될 수 있다. 요청 때마다 실행되게 한다.
  await connection();

  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true, db: "up" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[health] DB 확인 실패", error);
    return Response.json(
      { ok: false, db: "down" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

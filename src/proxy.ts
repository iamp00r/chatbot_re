import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16의 proxy(구 middleware). 로그인 세션 갱신과 비로그인 사용자 이동을 맡는다.
 * 기본 런타임은 Node.js다.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // 정적 파일·이미지 최적화·파비콘·이미지 확장자는 건너뛴다
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

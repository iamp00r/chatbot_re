import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { requireSupabaseEnv } from "./env";

/**
 * 서버(서버 컴포넌트·서버 액션·라우트 핸들러)용 Supabase 클라이언트.
 * 요청마다 새로 만든다 — 쿠키가 요청마다 다르고, 클라이언트를 공유하면 다른 사용자의 세션이 섞일 수 있다.
 * anon 키 + 사용자 JWT로 접속하므로 RLS가 그대로 적용된다(서비스 롤 키를 쓰지 않는다).
 */
export async function createClient() {
  // 세션 확인은 토큰 만료를 현재 시각(Date.now)과 비교한다. Cache Components에서는 이런 값을 쓰기 전에
  // connection()으로 "요청 시점 렌더링"임을 밝혀야 한다(빌드·프리페치 단계에서 미리 그리지 않게).
  await connection();
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 서버 컴포넌트 렌더링 중에는 쿠키를 쓸 수 없다. 세션 갱신은 proxy가 맡으므로 무시해도 된다.
        }
      },
    },
  });
}

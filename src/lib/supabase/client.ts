"use client";

import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseEnv } from "./env";

/**
 * 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트.
 * 세션은 쿠키에 저장되므로 서버(proxy·서버 컴포넌트)와 같은 세션을 본다.
 * PKCE 코드 검증값(code verifier)도 쿠키에 남아 /auth/callback에서 서버가 코드를 교환할 수 있다.
 */
export function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  return createBrowserClient(url, anonKey);
}

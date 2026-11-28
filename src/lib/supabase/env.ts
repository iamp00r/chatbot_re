/**
 * Supabase 공개 설정(주소·anon 키). 브라우저에도 노출되는 값이다.
 * NEXT_PUBLIC_* 는 빌드 때 코드에 박히므로 반드시 `process.env.이름` 형태로 직접 읽는다.
 * 값이 없으면 null — CI처럼 Supabase 없이 빌드·테스트하는 환경에서도 앱이 뜨게 한다(이때는 전부 "로그인 안 됨").
 */
export function getSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function requireSupabaseEnv(): { url: string; anonKey: string } {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY가 없습니다. .env.local을 확인하세요 (.env.example 참고).",
    );
  }
  return env;
}

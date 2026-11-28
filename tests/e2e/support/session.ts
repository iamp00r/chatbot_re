import type { BrowserContext } from "@playwright/test";

export const FAKE_SUPABASE_URL = "http://127.0.0.1:54399";

/**
 * 가짜 Supabase가 인정하는 로그인 세션 쿠키를 브라우저에 넣는다.
 * @supabase/ssr의 쿠키 형식: 이름 `sb-<프로젝트 ref>-auth-token`, 값 `base64-` + base64url(세션 JSON).
 * ref는 Supabase 주소의 첫 호스트 이름 조각(여기서는 "127").
 */
export async function signInAs(
  context: BrowserContext,
  baseURL: string,
  user: { id: string; email: string; name?: string },
) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const claims = {
    sub: user.id,
    email: user.email,
    role: "authenticated",
    aud: "authenticated",
    exp,
    user_metadata: user.name ? { name: user.name } : {},
  };
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const accessToken = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims)}.fake-signature`;
  const session = {
    access_token: accessToken,
    refresh_token: "fake-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    user: {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      user_metadata: claims.user_metadata,
      app_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: `base64-${b64(session)}`,
      url: baseURL,
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
}

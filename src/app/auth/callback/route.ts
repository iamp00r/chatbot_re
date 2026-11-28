import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { LOGIN_PATH, safeNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "magiclink",
  "signup",
  "invite",
  "recovery",
]);

/**
 * 로그인 완료 지점.
 * - Google OAuth·매직링크(기본 메일 양식): `?code=` → PKCE 코드 교환
 * - 매직링크(메일 양식을 token_hash로 바꾼 경우): `?token_hash=&type=` → OTP 검증
 * 성공하면 세션 쿠키를 쓰고 `next`(안전한 내부 경로만)로 보낸다. 프로필이 없으면 그 화면이 /onboarding으로 보낸다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`${LOGIN_PATH}?error=${reason}`, origin), {
      headers: { "Cache-Control": "no-store" },
    });

  if (searchParams.get("error")) return fail("denied");

  let errorMessage: string | null = null;
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    errorMessage = error?.message ?? null;
  } else if (tokenHash && type && EMAIL_OTP_TYPES.has(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    errorMessage = error?.message ?? null;
  } else {
    return fail("callback");
  }

  if (errorMessage) {
    console.error("[auth/callback] 로그인 완료 실패", errorMessage);
    return fail("callback");
  }

  return NextResponse.redirect(new URL(next, origin), {
    headers: { "Cache-Control": "no-store" },
  });
}

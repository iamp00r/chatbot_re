import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import { LOGIN_PATH, ONBOARDING_PATH } from "./paths";

/**
 * 데이터 접근 계층(DAL): 현재 사용자·프로필 확인을 한곳에 모은다.
 * proxy의 검사는 낙관적 검사일 뿐이라, 보호가 필요한 화면·서버 액션은 반드시 여기를 거친다.
 * `cache`로 한 요청 안에서는 한 번만 확인한다.
 */

export type SessionUser = {
  id: string;
  email: string | null;
  metadata: Record<string, unknown>;
};

export type Profile = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
};

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  // getClaims: JWT 서명을 검증한 결과만 믿는다
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    metadata: (claims.user_metadata as Record<string, unknown> | undefined) ?? {},
  };
});

export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createClient();
  // RLS(profiles_own)가 본인 행만 돌려준다. id 조건은 의도를 드러내기 위해 함께 건다.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`프로필을 읽지 못했습니다: ${error.message}`);
  if (!data) return null;
  return { id: data.id, nickname: data.nickname, avatarUrl: data.avatar_url };
});

/** 로그인만 확인한다(온보딩 화면용). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

/** 로그인 + 프로필(닉네임)까지 확인한다. 앱 화면은 이것을 쓴다. */
export async function requireProfile(): Promise<{ user: SessionUser; profile: Profile }> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect(ONBOARDING_PATH);
  return { user, profile };
}

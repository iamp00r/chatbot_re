"use server";

import { redirect } from "next/navigation";

import { getProfile, requireUser } from "@/lib/auth/dal";
import { nicknameSchema, safeAvatarUrl } from "@/lib/auth/nickname";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error: string | null };

/** 첫 로그인 시 닉네임으로 profiles 행을 만든다. */
export async function createProfile(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  // 서버 액션은 누구나 직접 호출할 수 있는 공개 엔드포인트다. 화면 검사와 별개로 여기서 다시 확인한다.
  const user = await requireUser();

  const parsed = nicknameSchema.safeParse(formData.get("nickname") ?? "");
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "닉네임을 확인하세요." };
  }

  if (!(await getProfile(user.id))) {
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").insert({
      id: user.id, // RLS with check: id = auth.uid() — 다른 id로는 만들 수 없다
      nickname: parsed.data,
      avatar_url: safeAvatarUrl(user.metadata.avatar_url ?? user.metadata.picture),
    });
    // 23505: 이미 있음(다른 탭에서 먼저 만든 경우) → 그대로 진행
    if (error && error.code !== "23505") {
      console.error("[onboarding] 프로필 생성 실패", error);
      return { error: "저장하지 못했습니다. 잠시 뒤 다시 시도하세요." };
    }
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}

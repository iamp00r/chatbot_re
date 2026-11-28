import { z } from "zod";

export const NICKNAME_MAX = 20;

/** 닉네임 규칙: 앞뒤 공백 제거 후 1~20자, 제어 문자 금지. */
export const nicknameSchema = z
  .string()
  .trim()
  .min(1, "닉네임을 입력하세요.")
  .max(NICKNAME_MAX, `닉네임은 ${NICKNAME_MAX}자 이하로 입력하세요.`)
  .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), "쓸 수 없는 문자가 들어 있습니다.");

/** Google 프로필 사진 주소처럼 https 주소만 받는다. 아니면 null. */
export function safeAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** 소셜 로그인 메타데이터에서 닉네임 기본값을 고른다(입력칸 미리 채우기용). */
export function suggestNickname(metadata: Record<string, unknown> | undefined): string {
  for (const key of ["name", "full_name", "user_name", "preferred_username"]) {
    const value = metadata?.[key];
    if (typeof value === "string") {
      const parsed = nicknameSchema.safeParse(value);
      if (parsed.success) return parsed.data;
      return value.trim().slice(0, NICKNAME_MAX);
    }
  }
  return "";
}

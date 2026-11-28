import { describe, expect, it } from "vitest";

import { nicknameSchema, safeAvatarUrl, suggestNickname } from "@/lib/auth/nickname";

describe("nicknameSchema", () => {
  it("앞뒤 공백을 지운다", () => {
    expect(nicknameSchema.parse("  하늘  ")).toBe("하늘");
  });

  it.each(["", "   ", "가".repeat(21), "줄\n바꿈"])("거절한다: %j", (v) => {
    expect(nicknameSchema.safeParse(v).success).toBe(false);
  });

  it("20자까지 받는다", () => {
    expect(nicknameSchema.safeParse("가".repeat(20)).success).toBe(true);
  });
});

describe("suggestNickname", () => {
  it("Google 이름을 기본값으로 쓴다", () => {
    expect(suggestNickname({ name: "김하늘" })).toBe("김하늘");
    expect(suggestNickname({ full_name: "Kim Haneul" })).toBe("Kim Haneul");
  });

  it("너무 길면 20자로 자른다", () => {
    expect(suggestNickname({ name: "a".repeat(30) })).toHaveLength(20);
  });

  it("없으면 빈 문자열", () => {
    expect(suggestNickname(undefined)).toBe("");
    expect(suggestNickname({ name: 3 })).toBe("");
  });
});

describe("safeAvatarUrl", () => {
  it("https만 받는다", () => {
    expect(safeAvatarUrl("https://lh3.googleusercontent.com/a/x")).toBe(
      "https://lh3.googleusercontent.com/a/x",
    );
    expect(safeAvatarUrl("http://example.com/a.png")).toBeNull();
    expect(safeAvatarUrl("javascript:alert(1)")).toBeNull();
    expect(safeAvatarUrl(undefined)).toBeNull();
  });
});

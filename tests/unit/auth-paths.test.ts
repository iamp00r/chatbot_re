import { describe, expect, it } from "vitest";

import { isAuthExempt, isPublicPath, safeNextPath } from "@/lib/auth/paths";

describe("safeNextPath — 로그인 뒤 돌아갈 주소", () => {
  it.each([
    ["/", "/"],
    ["/rooms/abc", "/rooms/abc"],
    ["/rooms/abc?tab=memory#n1", "/rooms/abc?tab=memory#n1"],
    ["/onboarding", "/onboarding"],
  ])("내부 경로는 그대로 둔다: %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["https://evil.example"],
    ["//evil.example"],
    ["//evil.example/path"],
    ["/\\evil.example"],
    ["javascript:alert(1)"],
    ["rooms"],
    ["/rooms\r\nSet-Cookie: x=1"],
    ["/login"],
    ["/login?next=/x"],
    ["/auth/callback"],
  ])("외부·위험 주소는 /로 바꾼다: %s", (input) => {
    expect(safeNextPath(input)).toBe("/");
  });

  it("경로 정규화로 바깥을 가리키게 만들 수 없다", () => {
    expect(safeNextPath("/../..//evil.example")).toBe("/");
    expect(safeNextPath("/a/..//evil.example")).toBe("/");
    expect(safeNextPath("/%2e%2e//evil.example")).toBe("/");
  });
});

describe("공개 경로", () => {
  it("헬스 체크는 인증 검사를 건너뛴다", () => {
    expect(isAuthExempt("/api/health")).toBe(true);
    expect(isAuthExempt("/api/health/x")).toBe(false);
    expect(isAuthExempt("/api/healthz")).toBe(false);
  });

  it.each(["/login", "/auth/callback", "/api/health"])("%s는 로그인 없이 열린다", (p) => {
    expect(isPublicPath(p)).toBe(true);
  });

  it.each(["/", "/onboarding", "/login2", "/api/jobs/run", "/rooms/1"])(
    "%s는 로그인이 필요하다",
    (p) => {
      expect(isPublicPath(p)).toBe(false);
    },
  );
});

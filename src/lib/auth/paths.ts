/**
 * 인증 관련 경로 규칙. proxy(Edge가 아닌 Node 런타임)와 라우트에서 함께 쓴다. 순수 함수만 둔다(테스트 대상).
 */

export const LOGIN_PATH = "/login";
export const ONBOARDING_PATH = "/onboarding";
export const AUTH_CALLBACK_PATH = "/auth/callback";

/** 인증 검사 자체를 건너뛰는 경로. keepalive가 호출하는 헬스 체크. */
export function isAuthExempt(pathname: string): boolean {
  return pathname === "/api/health";
}

/** 로그인하지 않아도 열리는 경로. */
export function isPublicPath(pathname: string): boolean {
  if (isAuthExempt(pathname)) return true;
  return (
    pathname === LOGIN_PATH ||
    pathname === AUTH_CALLBACK_PATH ||
    pathname.startsWith(`${AUTH_CALLBACK_PATH}/`)
  );
}

/**
 * 로그인 뒤 돌아갈 경로(`next`)를 안전하게 정리한다. 오픈 리다이렉트 방지:
 * 같은 사이트 안의 경로(`/`로 시작)만 허용하고, `//evil.com`, `/\evil.com`, `https://…` 등은 `/`로 바꾼다.
 * 로그인·콜백 경로로 되돌아가는 것도 막는다(무한 반복 방지).
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  // 제어 문자(줄바꿈 등)가 섞이면 헤더 조작에 쓰일 수 있다
  if (/[\u0000-\u001f\u007f]/.test(next)) return "/";

  const base = "http://loom.invalid";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return "/";
  }
  if (url.origin !== base) return "/";
  // `/../..//evil.com`은 정규화되면 `//evil.com`(프로토콜 상대 주소 = 외부 사이트)이 된다. 결과도 다시 확인한다.
  if (url.pathname.startsWith("//") || url.pathname.includes("\\")) return "/";
  if (url.pathname === LOGIN_PATH || url.pathname.startsWith("/auth/")) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}

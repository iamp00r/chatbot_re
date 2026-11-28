import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isAuthExempt, isPublicPath, LOGIN_PATH } from "@/lib/auth/paths";

import { getSupabaseEnv } from "./env";

/**
 * 모든 요청 앞에서 (1) 만료된 세션 토큰을 갱신해 쿠키에 다시 쓰고 (2) 로그인 여부로 이동을 정한다.
 * 여기는 "낙관적 검사"다. 실제 권한은 서버 코드(DAL)와 DB의 RLS가 다시 확인한다.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isAuthExempt(pathname)) {
    return NextResponse.next({ request });
  }

  const env = getSupabaseEnv();
  let response = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};
  let isLoggedIn = false;

  if (env) {
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // 갱신된 토큰을 이후 렌더링(서버 컴포넌트)이 읽도록 요청에도, 브라우저가 저장하도록 응답에도 쓴다
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // 토큰이 담긴 응답을 CDN이 캐시해 다른 사람에게 주지 않도록
          cacheHeaders = headers;
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    });

    // createServerClient와 getClaims 사이에 다른 코드를 넣지 않는다(세션이 예고 없이 끊길 수 있음).
    // getClaims는 JWT 서명을 검증한다. getSession()은 쿠키 값을 믿기만 하므로 쓰지 않는다.
    const { data } = await supabase.auth.getClaims();
    isLoggedIn = Boolean(data?.claims?.sub);
  }

  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    // 갱신된 세션 쿠키를 잃지 않게 옮겨 담는다
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    for (const [key, value] of Object.entries(cacheHeaders)) redirect.headers.set(key, value);
    return redirect;
  };

  if (!isLoggedIn && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const next = `${pathname}${request.nextUrl.search}`;
    return redirectTo(next === "/" ? LOGIN_PATH : `${LOGIN_PATH}?next=${encodeURIComponent(next)}`);
  }

  if (isLoggedIn && pathname === LOGIN_PATH) {
    return redirectTo("/");
  }

  return response;
}

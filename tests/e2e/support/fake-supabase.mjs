// E2E용 가짜 Supabase 서버 (Auth·REST의 일부만). 실제 Supabase 없이 로그인 이후 흐름을 검사한다.
// - GET  /auth/v1/user          : 토큰 서명이 "fake-signature"이면 그 토큰의 사용자로 인정
// - POST /auth/v1/logout        : 204
// - GET  /rest/v1/profiles      : ?id=eq.<uuid> 로 조회
// - POST /rest/v1/profiles      : 생성 (요청 토큰의 sub와 id가 같아야 함 — RLS 흉내)
// 상태는 메모리에만 있다. 테스트마다 다른 사용자 id를 써서 서로 섞이지 않게 한다.
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54399);
export const FAKE_SIGNATURE = "fake-signature";

/** @type {Map<string, {id: string, nickname: string, avatar_url: string | null}>} */
const profiles = new Map();

function decodeToken(header) {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const [, payload, signature] = token.split(".");
  if (signature !== FAKE_SIGNATURE || !payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const claims = decodeToken(req.headers.authorization);

  if (url.pathname === "/health") return send(res, 200, { ok: true });

  if (url.pathname === "/auth/v1/user" && req.method === "GET") {
    if (!claims) return send(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
    return send(res, 200, {
      id: claims.sub,
      aud: "authenticated",
      role: "authenticated",
      email: claims.email,
      user_metadata: claims.user_metadata ?? {},
      app_metadata: {},
      created_at: new Date().toISOString(),
    });
  }

  if (url.pathname === "/auth/v1/logout") {
    res.writeHead(204);
    return res.end();
  }

  if (url.pathname === "/rest/v1/profiles") {
    if (!claims) return send(res, 401, { code: "PGRST301", message: "JWT invalid" });

    if (req.method === "GET") {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      // RLS 흉내: 본인 행만 보인다
      const rows = [...profiles.values()].filter(
        (p) => p.id === claims.sub && (!id || p.id === id),
      );
      if (req.headers.accept?.includes("vnd.pgrst.object")) {
        if (rows.length !== 1) {
          return send(res, 406, {
            code: "PGRST116",
            message: "no rows",
            details: null,
            hint: null,
          });
        }
        return send(res, 200, rows[0]);
      }
      return send(res, 200, rows);
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const row = Array.isArray(body) ? body[0] : body;
      if (!row || row.id !== claims.sub) {
        return send(res, 403, {
          code: "42501",
          message: "new row violates row-level security policy",
        });
      }
      if (profiles.has(row.id)) {
        return send(res, 409, { code: "23505", message: "duplicate key value" });
      }
      profiles.set(row.id, {
        id: row.id,
        nickname: row.nickname,
        avatar_url: row.avatar_url ?? null,
      });
      return send(res, 201);
    }
  }

  return send(res, 404, { message: `fake-supabase: ${req.method} ${url.pathname} 없음` });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[fake-supabase] http://127.0.0.1:${PORT}`);
});

import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * 서버 전용 DB 클라이언트 (Drizzle + postgres.js).
 * DATABASE_URL은 Postgres 관리자 접속이라 RLS를 우회한다. → 쿼리마다 소유권을 코드에서 확인한다(명세서 §4.3).
 * Supabase "Transaction pooler"(포트 6543) 주소를 쓰므로 prepared statement를 끈다.
 */
function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL이 없습니다. .env.local을 확인하세요 (.env.example 참고).");
  }
  const sql = postgres(url, { prepare: false, max: 5 });
  return drizzle(sql, { schema, casing: "snake_case" });
}

type Db = ReturnType<typeof createDb>;

// 개발 서버의 핫 리로드마다 연결이 새로 생기지 않게 전역에 하나만 둔다
const globalForDb = globalThis as unknown as { __loomDb?: Db };

export function getDb(): Db {
  globalForDb.__loomDb ??= createDb();
  return globalForDb.__loomDb;
}

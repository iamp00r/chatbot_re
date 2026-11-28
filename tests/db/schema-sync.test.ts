/**
 * Drizzle 스키마(src/lib/db/schema.ts)와 실제 DB(마이그레이션 적용 결과)의 컬럼이 같은지 확인한다.
 * TEST_DATABASE_URL이 있을 때만 돈다 (CI의 DB 작업, scripts/db-test-local.sh 이후).
 */
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";

const url = process.env.TEST_DATABASE_URL;

const tables = (Object.values(schema) as unknown[])
  .filter((v): v is PgTable => v instanceof PgTable)
  .map((t) => getTableConfig(t))
  .filter((c) => (c.schema ?? "public") === "public");

describe.skipIf(!url)("Drizzle 스키마 ↔ DB 동기화", () => {
  const sql = postgres(url ?? "", { max: 1 });
  afterAll(() => sql.end());

  it("public 테이블 목록이 같다", async () => {
    const rows = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'`;
    expect(tables.map((t) => t.name).sort()).toEqual(rows.map((r) => r.table_name).sort());
  });

  it.each(tables.map((t) => [t.name, t] as const))(
    "%s: 컬럼 이름과 not null이 같다",
    async (name, cfg) => {
      const rows = await sql<{ column_name: string; is_nullable: "YES" | "NO" }[]>`
      select column_name, is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = ${name}`;
      const db = Object.fromEntries(rows.map((r) => [r.column_name, r.is_nullable === "NO"]));
      const pkCols = new Set(cfg.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name)));
      const drizzleCols = Object.fromEntries(
        cfg.columns.map((c) => [c.name, c.notNull || c.primary || pkCols.has(c.name)]),
      );
      expect(drizzleCols).toEqual(db);
    },
  );
});

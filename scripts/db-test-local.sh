#!/usr/bin/env bash
# 마이그레이션 + RLS·정합성 테스트를 "빈 로컬 Postgres"에서 돌린다 (Supabase 없이 검증).
#   DATABASE_URL=postgres://user:pass@localhost:5432/postgres scripts/db-test-local.sh
# 테스트용 DB(loom_test)를 지우고 새로 만든다. 실제 Supabase DB에는 쓰지 않는다.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL 이 필요합니다 (로컬 Postgres 관리자 접속 주소)}"
case "$DATABASE_URL" in
  *supabase.co*|*supabase.com*) echo "실제 Supabase 주소에는 실행하지 않습니다." >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB=loom_test
TEST_URL="${DATABASE_URL%/*}/$DB"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" "$DATABASE_URL" -c "drop database if exists $DB with (force)" -c "create database $DB"

"${PSQL[@]}" "$TEST_URL" -f "$ROOT/supabase/tests/local_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ migrate $(basename "$f")"
  "${PSQL[@]}" "$TEST_URL" -f "$f"
done
"${PSQL[@]}" "$TEST_URL" -f "$ROOT/supabase/tests/local_supabase_grants.sql"

for f in "$ROOT"/supabase/tests/*.test.sql; do
  echo "→ test $(basename "$f")"
  # NOTICE(ok 줄)와 오류만 보여 준다. 실패하면 psql이 0이 아닌 코드로 끝나고 pipefail로 스크립트가 멈춘다.
  "${PSQL[@]}" "$TEST_URL" -f "$f" 2>&1 | sed -n -e 's/.*NOTICE:  /  /p' -e '/ERROR\|DETAIL\|CONTEXT\|HINT/p'
done

echo "모든 DB 테스트 통과"

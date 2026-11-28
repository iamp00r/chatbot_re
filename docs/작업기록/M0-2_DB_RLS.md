# M0-2 DB 스키마, 정합성 트리거, RLS

| PR | 이슈 | 완료일 | 주요 파일 |
|---|---|---|---|
| #12 | #7 | 2026-11-27 | `supabase/migrations/*.sql`, `supabase/tests/*.sql`, `scripts/db-test-local.sh`, `.github/workflows/db.yml`, `src/lib/db/{schema,client}.ts`, `tests/db/schema-sync.test.ts` |

## 개요

명세서 §4.2의 테이블 20개, §4.4의 정합성 규칙, §4.3의 RLS를 **SQL 마이그레이션 3개**로 구현해 Supabase(서울)에 적용했다. 앱 코드에서 DB를 쓰기 위한 Drizzle 스키마·클라이언트를 추가했고, 마이그레이션·RLS·Drizzle 동기화를 **PR마다 빈 Postgres에서 자동 테스트**한다.

## 구현 내용

### 1. 스키마 (`…01_init_schema.sql`)

| 묶음 | 테이블 | 비고 |
|---|---|---|
| 사용자 | `profiles`, `personas` | `profiles.id` = `auth.users.id` (Supabase Auth와 1:1) |
| 제작 | `characters`, `stories`, `story_characters` | 1:1 채팅도 "등장인물 1명인 작품" |
| 원작 기억 | `canon_nodes`, `canon_edges`, `canon_memories` | 작품 주인이 정한 초기 기억. 방 생성 시 복사 |
| 채팅 | `rooms`, `room_participants`, `messages` | `messages`는 `(seq, variant)`로 재생성 변형 저장 |
| 기억 | `mem_nodes`, `mem_edges`, `memories`, `memory_subjects`, `memory_knowers` | 노드·관계 그래프 + 기억 + "누구에 관한"·"누가 아는" 연결 테이블 |
| 파이프라인 | `memory_ops`, `memory_jobs`, `room_summaries`, `generation_logs` | 자동 변경 이력(되돌리기용), 작업 큐, 줄거리 요약, LLM 호출 로그 |

- 확장: `pg_trgm`(유사 문자열 검색, 기억 검색 점수에 사용), `vector`(v1 임베딩 대비, 지금은 켜기만). Supabase 관례대로 `extensions` 스키마에 설치.
- `rooms.next_seq`: 메시지 순번 발급기. **되감기해도 줄이지 않는다** → seq를 재사용하지 않아 무효화된 기억이 가리키는 seq와 새 메시지가 섞이지 않는다.
- FK 삭제 동작: 방·기억처럼 소유 관계는 `cascade`, 캐릭터를 가리키는 표시용 참조는 `set null`.

### 2. 정합성 트리거·제약 (`…02_integrity.sql`)

| 규칙 | 구현 |
|---|---|
| `updated_at` 자동 갱신 | `set_updated_at()` 트리거를 `updated_at` 있는 테이블 전부에 `do` 블록으로 일괄 부착 |
| 같은 seq에 선택된 변형은 하나 | 부분 유니크 인덱스 `where is_selected and deleted_at is null` |
| 방 안의 노드 이름 유일 | `unique (room_id, lower(regexp_replace(name,'\s+','','g'))) where status='active'` — 대소문자·공백 무시, 무효화된 이름은 재사용 가능 |
| 기억↔노드는 같은 방, 아는 사람은 인물만 | `check_memory_node_link()` 트리거 (아래) |
| 관계의 양 끝 노드는 같은 방 | `check_edge_nodes()` 트리거 |
| 계정 삭제 순서 고정 | `profiles` 삭제 전 `stories` 먼저 삭제하는 트리거 |

```sql
-- memory_knowers / memory_subjects 에 insert·update 전에 실행
select room_id, kind into node_room, node_kind from public.mem_nodes where id = new.node_id;
select room_id into memory_room from public.memories where id = new.memory_id;
if node_room is distinct from memory_room then raise exception ... using errcode = 'check_violation';
if tg_table_name = 'memory_knowers' and node_kind not in ('character','user','npc') then raise exception ...;
```
CHECK 제약은 같은 행의 값만 볼 수 있어서, **다른 테이블을 봐야 하는 규칙은 트리거**로 구현했다.

### 3. RLS (`…03_rls.sql`)

원칙
- 20개 테이블 전부 `enable row level security`. 정책은 `authenticated` 역할에만 → `anon`(비로그인)은 아무것도 못 한다.
- 서버는 RLS를 우회하는 접속(서비스 역할/`DATABASE_URL`)을 쓰고, **코드에서 소유권을 한 번 더 확인**한다(이중 방어).
- 파이프라인 테이블(`memory_ops`, `memory_jobs`, `room_summaries`, `generation_logs`)은 사용자에게 **select만**. 쓰기는 서버만.

소유권 헬퍼 함수 (`private` 스키마)
```sql
create function private.owns_room(p_room_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.rooms r
                     where r.id = p_room_id and r.owner_id = (select auth.uid())) $$;
```
정책 예시
```sql
create policy profiles_own on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- 방에 딸린 테이블들: using (private.owns_room(room_id))
-- 작품: 소유자는 전부, 공개(public/unlisted)이면서 승인(approved)된 것은 읽기만
```

### 4. 앱 쪽 DB 연결
- `src/lib/db/schema.ts`: Drizzle 테이블 정의. **컬럼·PK·FK만** 옮기고, 제약·트리거·RLS는 SQL에만 둔다(쿼리 타입용).
- `src/lib/db/client.ts`: `import "server-only"`(브라우저 번들에 들어가면 빌드 실패), `postgres(url, { prepare: false, max: 5 })`, 개발 서버 핫 리로드 때 연결이 늘지 않게 `globalThis`에 싱글턴.

### 5. 테스트 인프라
- `scripts/db-test-local.sh`: 빈 Postgres에 `loom_test` DB를 새로 만들고 → Supabase 흉내(stub) → 마이그레이션 → SQL 테스트. Supabase 주소면 실행 거부.
- `supabase/tests/local_supabase_stub.sql`: Supabase가 원래 제공하는 `anon/authenticated/service_role` 역할, `auth` 스키마, `auth.uid()`를 최소한으로 흉내. `auth.uid()`는 `request.jwt.claims` 설정값을 읽으므로 테스트에서 `set_config`로 "A로 로그인"을 흉내 낼 수 있다.
- `.github/workflows/db.yml`: `pgvector/pgvector:pg17` 서비스 컨테이너로 위 스크립트 + `tests/db/schema-sync.test.ts`. DB 관련 파일을 바꾼 PR에서만 실행.

## 동작 방식

```
브라우저(로그인 사용자 A) ─ Supabase 클라이언트(anon 키 + A의 JWT)
   → Postgres: role=authenticated, auth.uid()=A
   → select * from messages
   → 행마다 정책 검사: private.owns_room(room_id) → A의 방 메시지만 반환

서버(Route Handler) ─ DATABASE_URL(관리자 접속, RLS 우회)
   → 코드에서 room.owner_id === 로그인 사용자 확인 후 쿼리
```

## 설계 결정

| 결정 | 선택 | 대안 | 이유 |
|---|---|---|---|
| DB | Supabase Postgres | Firebase(NoSQL) | 인물·관계·기억은 관계형 데이터. Auth·RLS·Storage 통합, 무료 플랜 |
| 지역 | 서울 | 미국 동부(기본) | 사용자·서버와 가까워 지연 감소 |
| 마이그레이션 관리 | SQL 파일이 기준(source of truth) | Drizzle Kit 생성/pull | 트리거·RLS·부분 인덱스는 SQL로만 정확히 표현. `drizzle-kit pull` 결과에 기본값·정책 누락이 있었다. 대신 동기화 테스트로 어긋남을 잡는다 |
| 권한 모델 | RLS + 서버 코드 이중 확인 | 서버 코드만 | 남의 대화·기억 유출은 치명적. 코드 실수가 있어도 DB가 막는다 |
| 정책 안 소유권 확인 | `security definer` 헬퍼 함수 | 정책에 서브쿼리 직접 작성 | 정책 안에서 다른 테이블을 읽으면 그 테이블의 RLS가 또 돌아 재귀·성능 문제. 헬퍼는 소유자 권한으로 한 번에 확인 |
| 헬퍼 위치 | `private` 스키마 | `public` | Supabase는 `public` 함수를 REST(RPC)로 노출한다. 노출되지 않는 스키마에 둔다 |
| 파이프라인 테이블 | 사용자 읽기 전용 | 사용자 쓰기 허용 | AI 변경 이력·LLM 로그를 사용자가 위조할 수 없게 |
| 기억 모델 | 노드·관계·기억 + subjects/knowers | 요약 텍스트 하나 | 표·그래프로 보고 고치기, 캐릭터별 "아는 것만" 필터(known_by)가 핵심 기능 |
| 테스트 DB | 빈 Postgres + Supabase stub | 실제 Supabase | 키 없이 PR마다 자동, 실제 데이터 무관 |

## 문제와 해결

| 문제 | 원인 | 해결 |
|---|---|---|
| 남이 내 공개 작품으로 방을 만들면 내 계정 삭제가 실패 | 작품을 가리키는 FK가 삭제를 막음(restrict) | 작품→방 `cascade`, 표시용 참조 `set null` (테스트로 발견) |
| 계정 삭제 시 cascade 경로 충돌 가능 | "작품→방→메시지"와 "캐릭터→메시지.character_id=null" 두 갈래가 동시에 돌면 이미 지워진 메시지를 갱신하려 함 | `profiles` 삭제 전 트리거로 작품부터 지워 순서 고정 |
| `drizzle-kit pull` 결과 부정확 | 기본값·정책 누락 | Drizzle 스키마는 손으로 쓰고, 실제 DB와 컬럼·not null 비교 테스트 추가(일부러 틀리게 바꾸면 실패하는 것도 확인) |
| Supabase Transaction pooler에서 쿼리 오류 가능 | pooler(6543, 트랜잭션 모드)는 연결을 트랜잭션마다 바꿔 끼워서 prepared statement를 유지하지 못함 | `prepare: false` |

## 테스트·검증

- `rls.test.sql` (한 트랜잭션, 끝에 rollback)
  - A는 자기 방·메시지·기억·아는 사람·로그를 본다 / `generation_logs`에 직접 쓰지 못한다
  - B가 A의 방을 조회하면 0행(id로 직접 조회해도) — **인수 조건**
  - B는 A의 방·메시지·작품을 수정·삭제 못 한다, 남의 방에 쓰거나 남의 비공개 작품으로 방을 못 만든다
  - B는 공개·승인 작품만 보고, 그걸로 자기 방은 만들 수 있다
  - 비로그인은 아무것도 못 본다
- `integrity.test.sql`: 아는 사람=인물 노드만, 같은 방 노드만, 이름 유일(무효화된 이름 재사용 가능), seq당 선택 1개, `updated_at` 갱신, 계정 삭제 cascade, 남의 방이 있어도 계정 삭제 가능
- `schema-sync.test.ts`: Drizzle과 실제 DB의 테이블 목록·컬럼·not null 일치
- 사용자가 Supabase SQL Editor에서 `rls.test.sql` 실행 → Success

## 명세서와 달라진 점

- 작품 삭제 시 방 cascade, 표시용 참조 set null (계정 삭제 보장, F-AU-3)
- `rooms.next_seq`는 되감기해도 감소하지 않음
- 파이프라인 테이블 4개는 사용자 읽기 전용
- 마이그레이션은 Drizzle Kit이 아니라 SQL 파일로 관리
- `stories.visibility`·`review_status` 등에 check 제약 보강 (명세 §4.3·§4.4에 반영 완료)

## 개념 정리

- **마이그레이션**: DB 구조 변경을 순서 있는 파일로 기록한 것. 파일을 순서대로 실행하면 어느 환경이든 같은 구조가 된다. 이미 적용된 파일은 고치지 않고 새 파일을 추가한다.
- **RLS (Row Level Security)**: 테이블에 "어떤 행을 누가 select/insert/update/delete할 수 있나" 정책을 붙이는 Postgres 기능. `using`은 기존 행을 볼 수 있는 조건, `with check`는 새로 쓰는 행이 만족해야 할 조건.
- **Supabase의 역할 구조**: 브라우저는 공개 `anon` 키로 접속하고, 로그인하면 JWT가 붙어 `authenticated` 역할 + `auth.uid()`=사용자 id가 된다. `service_role` 키는 `bypassrls` — 서버 전용.
- **`(select auth.uid())`로 감싸는 이유**: 함수 호출을 서브쿼리로 감싸면 Postgres가 쿼리당 한 번만 계산(initPlan)해 행마다 호출하지 않는다. Supabase 권장 성능 패턴.
- **`security definer` + `set search_path = ''`**: 함수를 만든 사람 권한으로 실행(RLS 재귀 회피). 이때 search_path를 비우고 모든 이름을 `public.rooms`처럼 스키마까지 적어야, 다른 스키마에 같은 이름의 객체를 만들어 함수를 속이는 공격을 막는다.
- **부분 유니크 인덱스**: `where` 조건을 만족하는 행끼리만 유일성 검사. "활성 상태끼리만 이름 중복 금지" 같은 규칙에 쓴다.
- **트리거 vs CHECK**: CHECK는 같은 행의 값만 검사 가능. 다른 테이블을 조회해야 하면 트리거.
- **Connection pooler**: 서버리스 함수는 요청마다 새 DB 연결을 만들 수 있어 Postgres 연결 한도를 금방 채운다. pooler(Supavisor)가 소수의 실제 연결을 나눠 쓰게 한다. 트랜잭션 모드는 트랜잭션 단위로 연결을 빌려주므로 세션 상태(prepared statement 등)를 쓸 수 없다.
- **ORM (Drizzle)**: 테이블을 TypeScript 코드로 정의해 쿼리 결과에 타입이 붙게 한다. 이 프로젝트는 "구조는 SQL, 타입은 Drizzle"로 역할을 나눴다.

## 참고

- 명세서 §4.2 DDL, §4.3 RLS, §4.4 정합성, §6 기억 시스템
- Supabase 문서: Row Level Security, Database → Connection pooling

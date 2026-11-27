# CLAUDE.md — 가칭 Loom (AI 캐릭터 채팅)

이 파일은 Claude Code가 세션을 시작할 때 자동으로 읽는다. 프로젝트의 전체 맥락은 `docs/`에 있다.

## 먼저 읽을 문서
1. `docs/00_프로젝트_컨텍스트.md` — 확정된 전제, 핵심 결정, 현재 상태 (필수)
2. `docs/03_MVP.md` — 지금 할 일(마일스톤·백로그·인수 조건)
3. `docs/02_기술명세서.md` — 설계(DDL, 기억 파이프라인, API). 구현 전에 해당 절을 읽는다
4. `docs/01_기획서.md` — 기능 요구사항(F-xx-n)과 배경
5. `docs/04_협업규칙.md` — 이슈·브랜치·PR 규칙

## 프로젝트 요약
"기억이 보이고, 고칠 수 있는" AI 캐릭터 채팅(크랙·제타류). 기억 그래프 + 표, 아는 사람(known_by) 범위가 있는 다중 캐릭터 대화. 개인 실험 + 포트폴리오, 전연령, 웹 우선.

## 협업 방식
- 팀은 2인: 사용자(기획 결정·검수·테스트), Claude(문서·설계·구현).
- 사용자와는 **한국어**로 소통한다.
- 사용자는 매번 묻지 않고 진행하길 원한다. 합리적으로 판단해 진행하고, 판단한 내용을 알린다. 되돌리기 어렵거나 비용이 드는 결정만 먼저 묻는다.
- 사용자는 개발 인프라(Supabase, Vercel, API 키 등)에 익숙하지 않을 수 있다. 계정 생성이나 키 설정이 필요하면 화면 순서대로 쉽게 안내한다.
- **API 키를 채팅에 붙여 넣게 하지 않는다.** 키는 사용자가 `.env.local`에 직접 넣는다. `.env*` 파일은 커밋하지 않는다(`.env.example`만 커밋).
- 설계와 구현이 달라지면 `docs/`를 함께 고치고, 결정이 바뀌면 `docs/00_프로젝트_컨텍스트.md`를 먼저 고친다.

## 기술 스택 (docs/02 §2)
Next.js(App Router, TypeScript) · Tailwind + shadcn/ui · Vercel AI SDK · Supabase(Postgres, Auth, RLS, Storage) · Drizzle ORM · Zod · TanStack Table · React Flow(@xyflow/react) · Vitest · Playwright · 패키지 매니저 pnpm

## 다음 작업
M0 기반 구축 (`docs/03_MVP.md` §4 M0-1 ~ M0-5). 키 없이 할 수 있는 것(M0-1 초기화, 마이그레이션 SQL 작성)부터 하고, Supabase 연결이 필요해지면 사용자에게 가입 절차를 안내한다.

## Git 작업 규칙 (상세: `docs/04_협업규칙.md`)
- 모든 작업은 **이슈 → 브랜치 → PR** 순서. `main`에 직접 푸시하지 않는다.
- 브랜치 이름: `<이슈번호>/<종류>-<영역>-<설명>` (예: `12/feat-fe-chat-streaming-ui`)
  - 종류: feat · fix · docs · refactor · test · chore
  - 영역: ai · fe · be · common
- 커밋: `<종류>(<영역>): <요약> (#이슈번호)`
- PR 본문에 `Closes #이슈번호`. 머지는 사용자가 검수 후 Squash and merge.
- 이슈와 PR에 라벨(종류 1개 + `area:*` 1개 이상)을 단다.

## 규칙
- Next.js는 16 버전이다. 학습 데이터와 API가 다를 수 있으니 `AGENTS.md` 안내대로 `node_modules/next/dist/docs/`를 확인한다.
- PR 전에 `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm e2e`가 통과해야 한다(CI와 같음).
- 커밋은 작게 자주. 백로그 ID(예: `M1-5`)가 있으면 이슈 제목에 적는다.
- 새 LLM 호출 경로는 반드시 `generation_logs`에 기록한다.
- 잠긴(locked) 기억은 자동 파이프라인이 절대 덮어쓰지 않는다.

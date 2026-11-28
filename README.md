# Loom (가칭)

"기억이 보이고, 고칠 수 있는" AI 캐릭터 채팅 서비스. 개인 실험 + 포트폴리오 프로젝트.

- 프로젝트 컨텍스트: [docs/00_프로젝트_컨텍스트.md](docs/00_프로젝트_컨텍스트.md)
- 기획서: [docs/01_기획서.md](docs/01_기획서.md)
- 기술 명세서: [docs/02_기술명세서.md](docs/02_기술명세서.md)
- MVP 정의서: [docs/03_MVP.md](docs/03_MVP.md)
- 협업 규칙: [docs/04_협업규칙.md](docs/04_협업규칙.md)

현재 상태: M0(기반 구축) 진행 중.

## 로컬에서 실행하기

필요한 것: Node.js 22 이상, pnpm 10 이상

```bash
pnpm install
cp .env.example .env.local   # 키는 .env.local에만 넣는다 (커밋 금지)
pnpm dev                     # http://localhost:3000
```

## 명령어

| 명령 | 하는 일 |
|---|---|
| `pnpm dev` | 개발 서버 |
| `pnpm build` / `pnpm start` | 프로덕션 빌드 / 실행 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript 타입 검사 |
| `pnpm format` / `pnpm format:check` | Prettier 서식 적용 / 검사 |
| `pnpm test` | 단위 테스트 (Vitest) |
| `pnpm e2e` | E2E 테스트 (Playwright, 빌드 후 실행) |

DB 테스트(마이그레이션·RLS)는 빈 로컬 Postgres가 있을 때 `DATABASE_URL=postgres://… scripts/db-test-local.sh`로 돌린다. CI에서는 자동으로 돈다.

E2E를 처음 돌릴 때는 브라우저를 한 번 설치한다: `pnpm exec playwright install chromium`

## 기술 스택

Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 + shadcn/ui · Vitest · Playwright ·
(예정) Vercel AI SDK · Supabase · Drizzle ORM · Zod · TanStack Table · React Flow

-- M0-2 (#7) 초기 스키마 — docs/02_기술명세서.md §4.2
-- 명세서 DDL을 그대로 옮기되, 아래만 보강했다.
--   * 확장은 Supabase 관례대로 extensions 스키마에 설치하고 타입·연산자를 스키마로 지정
--   * stories.visibility / review_status, canon_edges.affinity에 characters·mem_edges와 같은 check 추가
--   * mem_edges.origin, memories.origin에 mem_nodes와 같은 check 추가
--   * room_participants.node_id → mem_nodes FK (mem_nodes 생성 후 지정)
--   * memory_subjects / memory_knowers의 기본키 컬럼 not null 명시
--   * 작품·캐릭터를 가리키는 FK의 삭제 동작 지정: 남의 공개 작품으로 만든 방이 있어도
--     작품 주인이 계정을 지울 수 있어야 한다(F-AU-3). 방은 cascade, 표시용 참조는 set null.

-- ───────────── 확장 ─────────────
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;   -- v1 임베딩용, 미리 활성화

-- ───────────── 사용자 ─────────────
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null,
  avatar_url text,
  created_at timestamptz default now()
);

-- ───────────── 캐릭터 ─────────────
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  name text not null,
  tagline text,                     -- 한 줄 소개 (표시용, 프롬프트 미사용)
  avatar_url text,
  appearance text,                  -- 외형
  personality text,                 -- 성격
  speech_style text,                -- 말투
  background text,                  -- 배경
  rules text,                       -- 반드시 지킬 것
  example_dialogues text check (char_length(example_dialogues) <= 2000),
  pronoun text,                     -- 서술 시 지칭
  visibility text not null default 'private'
    check (visibility in ('private','unlisted','public')),
  review_status text not null default 'none'
    check (review_status in ('none','pending','approved','rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index characters_owner on public.characters(owner_id);

-- ───────────── 작품 (1:1도 작품) ─────────────
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  title text not null,
  description text,                 -- 소개글 (표시용)
  world_setting text,               -- 세계관·기본 상황·진행 방향 (프롬프트용)
  intro text not null,              -- 첫 메시지
  intro_speaker_id uuid references public.characters on delete set null, -- null이면 내레이터
  tags text[] default '{}',
  visibility text not null default 'private'
    check (visibility in ('private','unlisted','public')),
  review_status text not null default 'none'
    check (review_status in ('none','pending','approved','rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index stories_owner on public.stories(owner_id);

create table public.story_characters (
  story_id uuid references public.stories on delete cascade,
  character_id uuid references public.characters on delete cascade,
  position int not null default 0,
  talkativeness real not null default 0.5 check (talkativeness between 0 and 1),
  primary key (story_id, character_id)
);

-- 원작 기억 템플릿 (작품 제작자가 정의, 채팅방 시작 시 복사)
create table public.canon_nodes (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories on delete cascade,
  kind text not null
    check (kind in ('character','user','npc','place','item','event','group','concept')),
  name text not null,
  aliases text[] default '{}',
  summary text,
  character_id uuid references public.characters on delete set null,  -- 등장 캐릭터 노드면 연결
  is_user boolean not null default false           -- 사용자(페르소나) 자리 노드
);
create index canon_nodes_story on public.canon_nodes(story_id);

create table public.canon_edges (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories on delete cascade,
  src uuid not null references public.canon_nodes on delete cascade,
  dst uuid not null references public.canon_nodes on delete cascade,
  relation text not null,
  description text,
  affinity int check (affinity between -100 and 100),
  directed boolean default true
);
create index canon_edges_story on public.canon_edges(story_id);

create table public.canon_memories (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories on delete cascade,
  content text not null,
  kind text not null default 'fact'
    check (kind in ('fact','event','promise','secret','preference','status')),
  importance int default 3 check (importance between 1 and 5),
  subject_node_ids uuid[] default '{}',
  knower_node_ids uuid[]            -- null = 모두 앎
);
create index canon_memories_story on public.canon_memories(story_id);

-- ───────────── 페르소나 ─────────────
create table public.personas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  name text not null,
  description text,                 -- 외형·성격·특이사항
  is_default boolean default false
);
create index personas_owner on public.personas(owner_id);

-- ───────────── 채팅방 ─────────────
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  story_id uuid not null references public.stories on delete cascade,  -- 작품이 지워지면 그 작품의 방도 지운다
  persona_id uuid references public.personas on delete set null,
  title text,
  summary text default '',               -- 줄거리 요약 (F-ME-8)
  summary_locked boolean default false,
  summary_upto_seq bigint default 0,     -- 요약에 반영된 마지막 메시지 seq
  extracted_upto_seq bigint default 0,   -- 기억 추출에 반영된 마지막 메시지 seq
  next_seq bigint not null default 1,    -- 되감기해도 줄이지 않는다 (seq는 재사용하지 않음)
  settings jsonb not null default '{}',  -- 모델, 응답 길이, 자동 이어 말하기 수 등
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index rooms_owner on public.rooms(owner_id);

create table public.room_participants (
  room_id uuid references public.rooms on delete cascade,
  character_id uuid references public.characters on delete cascade,
  in_scene boolean not null default true,     -- F-MC-5 장면 참여
  talkativeness real not null default 0.5,
  node_id uuid,                                -- 이 캐릭터의 mem_nodes.id (FK는 아래에서 지정)
  primary key (room_id, character_id)
);

-- ───────────── 메시지 ─────────────
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  seq bigint not null,                    -- 방 안의 순서 (같은 seq = 재생성 후보들)
  variant int not null default 0,         -- 재생성 후보 번호
  is_selected boolean not null default true,
  role text not null check (role in ('user','character','narrator','system')),
  character_id uuid references public.characters on delete set null,   -- role=character일 때
  content text not null,
  whisper_to uuid[],                       -- F-MC-6: 귓속말 대상 character_id들
  is_ooc boolean not null default false,   -- F-CH-7
  present_character_ids uuid[] not null default '{}', -- 생성 시점에 장면에 있던 캐릭터
  deleted_at timestamptz,                  -- 되감기(소프트 삭제)
  edited_at timestamptz,
  flagged boolean not null default false,  -- 모더레이션
  created_at timestamptz default now()
);
create unique index messages_room_seq_variant on public.messages(room_id, seq, variant);
create index messages_room_active on public.messages(room_id, seq)
  where deleted_at is null and is_selected;

-- ───────────── 기억 그래프 ─────────────
create table public.mem_nodes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  kind text not null
    check (kind in ('character','user','npc','place','item','event','group','concept')),
  name text not null,
  aliases text[] not null default '{}',
  summary text default '',                 -- 한두 문장 요약
  attributes jsonb not null default '{}',  -- 자유 속성
  character_id uuid references public.characters on delete set null, -- 참여 캐릭터 노드
  origin text not null check (origin in ('canon','auto','user')),
  locked boolean not null default false,
  status text not null default 'active' check (status in ('active','invalidated','merged')),
  merged_into uuid references public.mem_nodes,
  source_seqs bigint[] not null default '{}',
  layout jsonb,                            -- 그래프 뷰 좌표 {x,y}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index mem_nodes_room on public.mem_nodes(room_id) where status = 'active';
create index mem_nodes_name_trgm on public.mem_nodes using gin (name extensions.gin_trgm_ops);

alter table public.room_participants
  add constraint room_participants_node_id_fkey
  foreign key (node_id) references public.mem_nodes on delete set null;

create table public.mem_edges (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  src uuid not null references public.mem_nodes on delete cascade,
  dst uuid not null references public.mem_nodes on delete cascade,
  relation text not null,          -- "소꿉친구", "라이벌", "짝사랑"
  description text default '',
  affinity int check (affinity between -100 and 100),  -- src가 dst에게 느끼는 감정
  directed boolean not null default true,
  origin text not null check (origin in ('canon','auto','user')),
  locked boolean not null default false,
  status text not null default 'active'
    check (status in ('active','superseded','invalidated')),
  superseded_by uuid references public.mem_edges,
  valid_from_seq bigint, valid_to_seq bigint,  -- 이야기 속 유효 구간
  source_seqs bigint[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index mem_edges_room on public.mem_edges(room_id) where status = 'active';

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  content text not null,           -- 한 문장. 3인칭, 이름 명시
  kind text not null default 'fact'
    check (kind in ('fact','event','promise','secret','preference','status')),
  importance int not null default 3 check (importance between 1 and 5),
  knowledge text not null default 'scoped'
    check (knowledge in ('everyone','scoped')),   -- everyone = 세계의 공지 사실
  story_time text,                  -- 이야기 속 시점 표현
  origin text not null check (origin in ('canon','auto','user')),
  locked boolean not null default false,
  pinned boolean not null default false,          -- 항상 주입
  status text not null default 'active'
    check (status in ('active','superseded','invalidated')),
  superseded_by uuid references public.memories,
  source_seqs bigint[] not null default '{}',
  last_used_at timestamptz,
  use_count int not null default 0,
  embedding extensions.vector(768), -- v1
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index memories_room_active on public.memories(room_id) where status = 'active';
create index memories_content_trgm on public.memories using gin (content extensions.gin_trgm_ops);

create table public.memory_subjects (   -- 기억이 "누구/무엇에 관한" 것인가
  memory_id uuid not null references public.memories on delete cascade,
  node_id uuid not null references public.mem_nodes on delete cascade,
  primary key (memory_id, node_id)
);
create table public.memory_knowers (    -- 기억을 "누가 아는가" (knowledge='scoped'일 때)
  memory_id uuid not null references public.memories on delete cascade,
  node_id uuid not null references public.mem_nodes on delete cascade,  -- 인물 노드만 (트리거)
  primary key (memory_id, node_id)
);
create index memory_knowers_node on public.memory_knowers(node_id);

-- 변경 기록 (F-ME-6, 되돌리기·감사)
create table public.memory_ops (
  id bigserial primary key,
  room_id uuid not null references public.rooms on delete cascade,
  job_id uuid,
  actor text not null check (actor in ('auto','user','system')),
  op text not null,                -- add_node / update_node / add_edge / supersede_edge / add_memory / …
  target_table text not null,
  target_id uuid not null,
  before jsonb,
  after jsonb,
  status text not null default 'applied'
    check (status in ('applied','proposed','rejected','reverted')),
  created_at timestamptz default now()
);
create index memory_ops_room on public.memory_ops(room_id, id);

-- 비동기 작업 큐
create table public.memory_jobs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  kind text not null check (kind in ('extract','summarize','invalidate_after')),
  from_seq bigint,
  to_seq bigint,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  attempts int not null default 0,
  locked_until timestamptz,
  error text,
  created_at timestamptz default now()
);
create unique index memory_jobs_dedupe on public.memory_jobs(room_id, kind, to_seq)
  where status in ('queued','running');

-- 생성 로그 (프롬프트 검사기 F-AD-2, 평가, 비용)
create table public.generation_logs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms on delete cascade,
  message_id uuid references public.messages on delete cascade,
  purpose text not null,            -- chat / extract / summarize / moderate
  model text not null,
  prompt jsonb not null,            -- 조립된 메시지 배열 전체
  injected_memory_ids uuid[] default '{}',
  injected_edge_ids uuid[] default '{}',
  input_tokens int,
  output_tokens int,
  cached_tokens int,
  ttft_ms int,
  total_ms int,
  finish_reason text,
  error text,
  created_at timestamptz default now()
);
create index generation_logs_room on public.generation_logs(room_id, created_at);
create index generation_logs_message on public.generation_logs(message_id);

-- 줄거리 스냅샷 (되감기 시 복원용, 방당 최근 10개 유지)
create table public.room_summaries (
  id bigserial primary key,
  room_id uuid not null references public.rooms on delete cascade,
  upto_seq bigint not null,
  text text not null,
  created_at timestamptz default now()
);
create index room_summaries_room on public.room_summaries(room_id, upto_seq);

-- 신고 (v1): reports(id, reporter_id, target_type, target_id, reason, status, created_at)

-- M0-2 (#7) RLS 정책 — docs/02_기술명세서.md §4.3
--
-- 원칙
--   * 모든 public 테이블에 RLS를 켠다. 정책은 로그인 사용자(authenticated)에게만 준다.
--   * 서버 Route Handler는 서비스 역할 키(RLS 우회)로 쓰고, 코드에서 소유권을 다시 확인한다(이중 방어).
--   * 자동 파이프라인 전용 테이블(memory_ops, memory_jobs, generation_logs, room_summaries)은
--     사용자에게 "읽기만" 허용한다. 쓰기는 서버(서비스 역할)만 한다.

-- ───────────── 소유권 헬퍼 ─────────────
-- security definer: 정책 안에서 다른 테이블을 볼 때 RLS가 겹쳐 도는 것(재귀·성능 저하)을 피한다.
-- API로 노출되지 않는 private 스키마에 둔다.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.owns_story(p_story_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.stories s
    where s.id = p_story_id and s.owner_id = (select auth.uid())
  );
$$;

create or replace function private.can_read_story(p_story_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.stories s
    where s.id = p_story_id
      and (
        s.owner_id = (select auth.uid())
        or (s.visibility in ('public','unlisted') and s.review_status = 'approved')
      )
  );
$$;

create or replace function private.owns_room(p_room_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id and r.owner_id = (select auth.uid())
  );
$$;

create or replace function private.owns_memory(p_memory_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memories m
    join public.rooms r on r.id = m.room_id
    where m.id = p_memory_id and r.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_story(uuid), private.can_read_story(uuid),
  private.owns_room(uuid), private.owns_memory(uuid) from public;
grant execute on function private.owns_story(uuid), private.can_read_story(uuid),
  private.owns_room(uuid), private.owns_memory(uuid) to authenticated;

-- ───────────── 테이블 권한 ─────────────
-- Supabase 기본 권한에 기대지 않고 명시한다. 실제로 무엇을 할 수 있는지는 아래 RLS 정책이 정한다.
-- anon(로그인 안 함)에는 정책을 주지 않으므로 아무것도 할 수 없다.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- ───────────── RLS 켜기 ─────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','characters','stories','story_characters',
    'canon_nodes','canon_edges','canon_memories','personas',
    'rooms','room_participants','messages',
    'mem_nodes','mem_edges','memories','memory_subjects','memory_knowers',
    'memory_ops','memory_jobs','generation_logs','room_summaries'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ───────────── 본인 것만: profiles, personas ─────────────
create policy profiles_own on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy personas_own on public.personas
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ───────────── 캐릭터·작품: 소유자 전부, 공개(승인)는 읽기만 ─────────────
create policy characters_read on public.characters
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (visibility in ('public','unlisted') and review_status = 'approved')
  );
create policy characters_insert on public.characters
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy characters_update on public.characters
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy characters_delete on public.characters
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy stories_read on public.stories
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (visibility in ('public','unlisted') and review_status = 'approved')
  );
create policy stories_insert on public.stories
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy stories_update on public.stories
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy stories_delete on public.stories
  for delete to authenticated using (owner_id = (select auth.uid()));

-- 작품에 딸린 테이블: 작품을 읽을 수 있으면 읽기, 작품 소유자만 쓰기
do $$
declare t text;
begin
  foreach t in array array['story_characters','canon_nodes','canon_edges','canon_memories'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.can_read_story(story_id))',
      t || '_read', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.owns_story(story_id))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.owns_story(story_id)) with check (private.owns_story(story_id))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.owns_story(story_id))',
      t || '_delete', t);
  end loop;
end;
$$;

-- ───────────── 채팅방 ─────────────
-- 만들 때: 본인 소유 + 읽을 수 있는 작품이어야 한다
create policy rooms_read on public.rooms
  for select to authenticated using (owner_id = (select auth.uid()));
create policy rooms_insert on public.rooms
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and private.can_read_story(story_id));
create policy rooms_update on public.rooms
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and private.can_read_story(story_id));
create policy rooms_delete on public.rooms
  for delete to authenticated using (owner_id = (select auth.uid()));

-- 채팅방 소속(사용자가 직접 보고 고치는 것): 방 소유자만 읽기·쓰기
do $$
declare t text;
begin
  foreach t in array array['room_participants','messages','mem_nodes','mem_edges','memories'] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (private.owns_room(room_id)) with check (private.owns_room(room_id))',
      t || '_own_room', t);
  end loop;
end;
$$;

create policy memory_subjects_own_room on public.memory_subjects
  for all to authenticated
  using (private.owns_memory(memory_id)) with check (private.owns_memory(memory_id));
create policy memory_knowers_own_room on public.memory_knowers
  for all to authenticated
  using (private.owns_memory(memory_id)) with check (private.owns_memory(memory_id));

-- 자동 파이프라인 전용: 방 소유자는 읽기만 (쓰기는 서비스 역할)
do $$
declare t text;
begin
  foreach t in array array['memory_ops','memory_jobs','room_summaries'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.owns_room(room_id))',
      t || '_read_own_room', t);
  end loop;
end;
$$;

-- generation_logs: 본인 채팅방 것만 읽기 (room_id가 없는 로그는 서버만 본다)
create policy generation_logs_read_own_room on public.generation_logs
  for select to authenticated
  using (room_id is not null and private.owns_room(room_id));

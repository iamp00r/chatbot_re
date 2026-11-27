-- M0-2 (#7) 정합성 규칙 — docs/02_기술명세서.md §4.4

-- ───────────── updated_at 자동 갱신 ─────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['characters','stories','rooms','mem_nodes','mem_edges','memories'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t);
  end loop;
end;
$$;

-- ───────────── 메시지: seq당 선택된 변형은 하나 ─────────────
-- 활성 경로(deleted_at is null and is_selected)에서 같은 seq가 두 번 나오지 않게 한다.
-- 스와이프 선택은 "이전 변형 false → 새 변형 true" 순서로 한 트랜잭션에서 바꾼다.
create unique index messages_one_selected_per_seq on public.messages(room_id, seq)
  where is_selected and deleted_at is null;

-- ───────────── 노드 이름: 방 안에서 대소문자·공백 무시하고 유일 (active끼리) ─────────────
create unique index mem_nodes_room_name_unique
  on public.mem_nodes(room_id, lower(regexp_replace(name, '\s+', '', 'g')))
  where status = 'active';

-- ───────────── 같은 방 검사 + 아는 사람은 인물 노드만 ─────────────
create or replace function public.check_memory_node_link()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  node_room uuid;
  node_kind text;
  memory_room uuid;
begin
  select room_id, kind into node_room, node_kind from public.mem_nodes where id = new.node_id;
  select room_id into memory_room from public.memories where id = new.memory_id;

  if node_room is distinct from memory_room then
    raise exception '기억(%)과 노드(%)가 서로 다른 채팅방에 있습니다', new.memory_id, new.node_id
      using errcode = 'check_violation';
  end if;

  if tg_table_name = 'memory_knowers' and node_kind not in ('character','user','npc') then
    raise exception '아는 사람에는 인물 노드(character, user, npc)만 넣을 수 있습니다 (kind=%)', node_kind
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger memory_knowers_check before insert or update on public.memory_knowers
  for each row execute function public.check_memory_node_link();
create trigger memory_subjects_check before insert or update on public.memory_subjects
  for each row execute function public.check_memory_node_link();

-- 엣지 양 끝 노드도 같은 방이어야 한다
create or replace function public.check_edge_nodes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.mem_nodes n
    where n.id in (new.src, new.dst) and n.room_id <> new.room_id
  ) then
    raise exception '엣지(%)의 노드가 다른 채팅방에 있습니다', new.id using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger mem_edges_check before insert or update of src, dst, room_id on public.mem_edges
  for each row execute function public.check_edge_nodes();

-- ───────────── 계정 삭제 순서 (F-AU-3) ─────────────
-- 프로필이 지워질 때 cascade가 "작품 → 채팅방 → 메시지"와 "캐릭터 → 메시지.character_id = null"
-- 두 갈래로 동시에 돌면, 이미 지워진 방의 메시지를 고치려다 실패할 수 있다.
-- 작품(과 거기서 만들어진 남의 채팅방)을 먼저 지워 순서를 고정한다.
create or replace function public.delete_profile_stories_first()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.stories where owner_id = old.id;
  return old;
end;
$$;

create trigger profiles_delete_stories_first before delete on public.profiles
  for each row execute function public.delete_profile_stories_first();

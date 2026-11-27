-- RLS 테스트 (M0-2 인수 조건: 다른 사용자의 room을 조회하면 0행)
-- 전체를 한 트랜잭션에서 실행하고 마지막에 rollback 하므로 데이터가 남지 않는다.
-- Supabase 대시보드의 SQL Editor에 붙여 넣어 실행해도 된다. 실패하면 오류로 멈춘다.

begin;

-- ── 준비: 사용자 A(소유자), B(남) ──
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'rls-test-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'rls-test-b@example.com');
insert into public.profiles (id, nickname) values
  ('00000000-0000-0000-0000-00000000000a', 'A'),
  ('00000000-0000-0000-0000-00000000000b', 'B');

insert into public.stories (id, owner_id, title, intro) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'A의 비공개 작품', '안녕'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'A의 공개 작품', '안녕');
update public.stories set visibility = 'public', review_status = 'approved'
  where id = '10000000-0000-0000-0000-000000000002';

insert into public.rooms (id, owner_id, story_id) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001');
insert into public.messages (room_id, seq, role, content) values
  ('20000000-0000-0000-0000-000000000001', 1, 'narrator', '비가 내린다.');
insert into public.mem_nodes (id, room_id, kind, name, origin) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'character', '리아', 'canon');
insert into public.memories (id, room_id, content, origin) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '리아는 딸기우유를 좋아한다.', 'auto');
insert into public.memory_knowers (memory_id, node_id) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');
insert into public.generation_logs (room_id, purpose, model, prompt) values
  ('20000000-0000-0000-0000-000000000001', 'chat', 'test:model', '[]');

-- ── A로 로그인: 자기 방이 보인다 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.rooms) <> 1 then raise exception 'A: 자기 room이 보여야 함'; end if;
  if (select count(*) from public.messages) <> 1 then raise exception 'A: 자기 메시지가 보여야 함'; end if;
  if (select count(*) from public.memories) <> 1 then raise exception 'A: 자기 기억이 보여야 함'; end if;
  if (select count(*) from public.memory_knowers) <> 1 then raise exception 'A: 아는 사람이 보여야 함'; end if;
  if (select count(*) from public.generation_logs) <> 1 then raise exception 'A: 자기 생성 로그가 보여야 함'; end if;
  raise notice 'ok  A는 자기 채팅방·메시지·기억·로그를 본다';
end $$;

-- A도 generation_logs에는 쓸 수 없다 (서버 전용)
do $$
begin
  begin
    insert into public.generation_logs (room_id, purpose, model, prompt)
      values ('20000000-0000-0000-0000-000000000001', 'chat', 'x', '[]');
    raise exception 'A: generation_logs 직접 쓰기가 막혀야 함';
  exception when insufficient_privilege then
    raise notice 'ok  사용자는 generation_logs에 직접 쓸 수 없다';
  end;
end $$;

-- ── B로 로그인: A의 것은 하나도 안 보인다 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

do $$
declare n int;
begin
  if (select count(*) from public.rooms) <> 0 then raise exception 'B: 다른 사용자의 room이 보이면 안 됨'; end if;
  if (select count(*) from public.rooms where id = '20000000-0000-0000-0000-000000000001') <> 0 then
    raise exception 'B: id로 직접 조회해도 0행이어야 함';
  end if;
  if (select count(*) from public.messages) <> 0 then raise exception 'B: 메시지가 보이면 안 됨'; end if;
  if (select count(*) from public.mem_nodes) <> 0 then raise exception 'B: 노드가 보이면 안 됨'; end if;
  if (select count(*) from public.memories) <> 0 then raise exception 'B: 기억이 보이면 안 됨'; end if;
  if (select count(*) from public.memory_knowers) <> 0 then raise exception 'B: 아는 사람이 보이면 안 됨'; end if;
  if (select count(*) from public.generation_logs) <> 0 then raise exception 'B: 생성 로그가 보이면 안 됨'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'B: 자기 프로필만 보여야 함'; end if;
  raise notice 'ok  B가 A의 room을 조회하면 0행 (인수 조건)';

  -- 작품: 비공개는 안 보이고, 공개·승인된 것은 보인다
  if (select count(*) from public.stories) <> 1 then raise exception 'B: 공개 작품 1개만 보여야 함'; end if;
  raise notice 'ok  B는 공개·승인된 작품만 본다';

  -- 고치기·지우기 시도는 0행에 적용된다
  update public.rooms set title = '탈취' where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B: 남의 room 수정이 막혀야 함'; end if;
  delete from public.messages where room_id = '20000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B: 남의 메시지 삭제가 막혀야 함'; end if;
  update public.stories set title = '탈취' where id = '10000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B: 남의 공개 작품 수정이 막혀야 함'; end if;
  raise notice 'ok  B는 A의 방·메시지·작품을 고치거나 지울 수 없다';
end $$;

-- 남의 방에 메시지 넣기, 남의 비공개 작품으로 방 만들기, 남인 척 방 만들기 → 거부
do $$
begin
  begin
    insert into public.messages (room_id, seq, role, content)
      values ('20000000-0000-0000-0000-000000000001', 2, 'user', '침입');
    raise exception 'B: 남의 방에 메시지를 넣을 수 있으면 안 됨';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.rooms (owner_id, story_id)
      values ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001');
    raise exception 'B: 남의 비공개 작품으로 방을 만들 수 있으면 안 됨';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.rooms (owner_id, story_id)
      values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000002');
    raise exception 'B: 다른 사람 명의로 방을 만들 수 있으면 안 됨';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok  B는 남의 방에 쓰거나 남의 비공개 작품으로 방을 만들 수 없다';
end $$;

-- 공개 작품으로는 자기 방을 만들 수 있다
insert into public.rooms (owner_id, story_id)
  values ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000002');
do $$ begin raise notice 'ok  B는 공개 작품으로 자기 방을 만들 수 있다'; end $$;

-- ── 로그인 안 한 사용자(anon): 아무것도 안 보인다 ──
reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);
do $$
begin
  if (select count(*) from public.rooms) <> 0 or (select count(*) from public.stories) <> 0 then
    raise exception 'anon: 아무것도 보이면 안 됨';
  end if;
  raise notice 'ok  로그인하지 않으면 아무것도 보이지 않는다';
end $$;

reset role;
rollback;

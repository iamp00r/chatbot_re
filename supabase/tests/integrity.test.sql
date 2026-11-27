-- 정합성 규칙 테스트 (docs/02 §4.4). 한 트랜잭션에서 실행하고 rollback 한다.

begin;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000c1');
insert into public.profiles (id, nickname) values ('00000000-0000-0000-0000-0000000000c1', 'C');
insert into public.stories (id, owner_id, title, intro)
  values ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1', 't', 'i');
insert into public.rooms (id, owner_id, story_id) values
  ('20000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c1'),
  ('20000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c1');
insert into public.mem_nodes (id, room_id, kind, name, origin) values
  ('30000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'character', '리아', 'canon'),
  ('30000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000c1', 'place', '시계탑', 'auto'),
  ('30000000-0000-0000-0000-0000000000c3', '20000000-0000-0000-0000-0000000000c2', 'character', '도윤', 'canon');
insert into public.memories (id, room_id, content, origin) values
  ('40000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', '리아는 시계탑에서 만나기로 했다.', 'auto');

do $$
begin
  -- 아는 사람은 인물 노드만
  insert into public.memory_knowers values
    ('40000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000c1');
  begin
    insert into public.memory_knowers values
      ('40000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000c2');
    raise exception '장소 노드가 아는 사람이 되면 안 됨';
  exception when check_violation then null;
  end;
  raise notice 'ok  memory_knowers에는 인물 노드만 들어간다';

  -- 기억과 노드는 같은 방
  begin
    insert into public.memory_subjects values
      ('40000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000c3');
    raise exception '다른 방의 노드를 연결하면 안 됨';
  exception when check_violation then null;
  end;
  begin
    insert into public.mem_edges (room_id, src, dst, relation, origin) values
      ('20000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000c1',
       '30000000-0000-0000-0000-0000000000c3', '친구', 'auto');
    raise exception '다른 방의 노드로 엣지를 만들면 안 됨';
  exception when check_violation then null;
  end;
  raise notice 'ok  기억·엣지는 같은 방의 노드만 가리킨다';

  -- 노드 이름: 대소문자·공백 무시 유일 (active끼리)
  begin
    insert into public.mem_nodes (room_id, kind, name, origin)
      values ('20000000-0000-0000-0000-0000000000c1', 'place', ' 시계 탑 ', 'auto');
    raise exception '공백만 다른 같은 이름이 허용되면 안 됨';
  exception when unique_violation then null;
  end;
  update public.mem_nodes set status = 'invalidated' where id = '30000000-0000-0000-0000-0000000000c2';
  insert into public.mem_nodes (room_id, kind, name, origin)
    values ('20000000-0000-0000-0000-0000000000c1', 'place', '시계탑', 'auto');
  raise notice 'ok  같은 방의 active 노드 이름은 유일하다 (무효화된 이름은 재사용 가능)';

  -- seq당 선택된 변형은 하나
  insert into public.messages (room_id, seq, variant, role, content)
    values ('20000000-0000-0000-0000-0000000000c1', 1, 0, 'character', '첫 변형');
  begin
    insert into public.messages (room_id, seq, variant, role, content)
      values ('20000000-0000-0000-0000-0000000000c1', 1, 1, 'character', '둘째 변형');
    raise exception '같은 seq에 선택된 변형이 둘이면 안 됨';
  exception when unique_violation then null;
  end;
  insert into public.messages (room_id, seq, variant, is_selected, role, content)
    values ('20000000-0000-0000-0000-0000000000c1', 1, 1, false, 'character', '둘째 변형');
  update public.messages set is_selected = false
    where room_id = '20000000-0000-0000-0000-0000000000c1' and seq = 1 and variant = 0;
  update public.messages set is_selected = true
    where room_id = '20000000-0000-0000-0000-0000000000c1' and seq = 1 and variant = 1;
  raise notice 'ok  seq당 선택된 변형은 하나다 (스와이프로 바꿀 수 있다)';

  -- updated_at 자동 갱신
  update public.rooms set title = '새 이름', updated_at = '2000-01-01'
    where id = '20000000-0000-0000-0000-0000000000c1';
  if (select updated_at from public.rooms where id = '20000000-0000-0000-0000-0000000000c1') < now() - interval '1 minute' then
    raise exception 'updated_at이 자동 갱신되어야 함';
  end if;
  raise notice 'ok  updated_at이 자동 갱신된다';

  -- 계정 삭제 시 cascade
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000c1';
  if (select count(*) from public.rooms where owner_id = '00000000-0000-0000-0000-0000000000c1') <> 0
     or (select count(*) from public.memories where room_id = '20000000-0000-0000-0000-0000000000c1') <> 0 then
    raise exception '계정 삭제 시 데이터가 함께 지워져야 함';
  end if;
  raise notice 'ok  계정을 지우면 작품·채팅방·기억이 함께 지워진다';
end $$;

-- 남(D)이 C의 공개 작품으로 만든 방이 있어도 C는 계정을 지울 수 있다
do $$
begin
  insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000c2'), ('00000000-0000-0000-0000-0000000000d1');
  insert into public.profiles (id, nickname) values
    ('00000000-0000-0000-0000-0000000000c2', 'C2'), ('00000000-0000-0000-0000-0000000000d1', 'D');
  insert into public.characters (id, owner_id, name)
    values ('50000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c2', '리아');
  insert into public.stories (id, owner_id, title, intro, intro_speaker_id, visibility, review_status)
    values ('10000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c2', '공개작', 'i',
            '50000000-0000-0000-0000-0000000000c2', 'public', 'approved');
  insert into public.story_characters (story_id, character_id)
    values ('10000000-0000-0000-0000-0000000000c2', '50000000-0000-0000-0000-0000000000c2');
  insert into public.rooms (id, owner_id, story_id)
    values ('20000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000c2');
  insert into public.room_participants (room_id, character_id)
    values ('20000000-0000-0000-0000-0000000000d1', '50000000-0000-0000-0000-0000000000c2');
  insert into public.messages (room_id, seq, role, character_id, content)
    values ('20000000-0000-0000-0000-0000000000d1', 1, 'character', '50000000-0000-0000-0000-0000000000c2', '안녕');

  delete from auth.users where id = '00000000-0000-0000-0000-0000000000c2';
  if (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000d1') <> 1 then
    raise exception 'D의 계정은 남아 있어야 함';
  end if;
  raise notice 'ok  남이 내 공개 작품으로 방을 만들었어도 내 계정을 지울 수 있다';
end $$;

rollback;

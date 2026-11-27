-- 로컬·CI 검증 전용. 가장 나쁜 경우를 가정해 anon(로그인 안 함)에게도 모든 테이블 권한을 준다.
-- 그래도 RLS가 막는지 rls.test.sql이 확인한다.
grant all on all tables in schema public to anon;
grant all on all sequences in schema public to anon;

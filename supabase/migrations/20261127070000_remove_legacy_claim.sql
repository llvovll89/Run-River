-- 주인 없는(user_id null) 기록을 아무 계정이나 가져가던 RPC 제거 + user_id null 신규 삽입 차단.
-- 기존 행과 select/update/delete 정책은 그대로 둔다.
begin;

drop function if exists public.claim_legacy_records(integer);
drop function if exists public.count_unclaimed_legacy_records();

-- user_id를 빠뜨려도 호출자 소유로 들어가게 한다
alter table public.running_records alter column user_id set default auth.uid();

drop policy if exists "running_records_insert_own" on public.running_records;
create policy "running_records_insert_own"
  on public.running_records
  for insert
  to authenticated
  with check (user_id = auth.uid());

commit;

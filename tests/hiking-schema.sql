\set ON_ERROR_STOP on
create table public.running_records (
  id integer primary key,
  user_id uuid,
  activity_type text not null check (activity_type in ('running', 'walking'))
);
alter table public.running_records enable row level security;
create policy retained_owner_policy on public.running_records for select using (user_id = '00000000-0000-0000-0000-000000000001'::uuid);
insert into public.running_records (id, activity_type) values (1, 'running'), (2, 'walking');
\ir ../supabase/migrations/20261114054130_add_hiking_activity.sql
insert into public.running_records (id, activity_type) values (3, 'hiking');
do $$
begin
  if (select count(*) from public.running_records) <> 3 then raise exception 'existing records lost'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.running_records'::regclass) then raise exception 'RLS disabled'; end if;
  if not exists (select 1 from pg_policies where tablename = 'running_records' and policyname = 'retained_owner_policy') then raise exception 'owner policy lost'; end if;
  begin
    insert into public.running_records (id, activity_type) values (4, 'unsupported');
    raise exception 'invalid activity accepted';
  exception when check_violation then null;
  end;
end $$;

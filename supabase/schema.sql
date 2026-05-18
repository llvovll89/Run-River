-- Run River Auth + RLS 마이그레이션 SQL
-- Supabase SQL Editor에서 순서대로 실행하세요.

create extension if not exists pgcrypto;

-- running_records ------------------------------------------------------------
create table if not exists public.running_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  start_point jsonb not null,
  end_point jsonb not null,
  distance_km double precision not null default 0,
  gps_distance_km_raw double precision,
  gap_adjustment_distance_km double precision,
  gap_adjustment_seconds double precision,
  gap_adjustment_count integer,
  gap_adjustment_auto_enabled boolean,
  duration_seconds integer not null default 0,
  pace double precision not null default 0,
  activity_type text not null default 'running' check (activity_type in ('running', 'walking')),
  altitude_start_m double precision,
  altitude_end_m double precision,
  elevation_gain_m double precision,
  elevation_loss_m double precision,
  memo text,
  created_at timestamptz not null default now(),
  constraint running_records_memo_len_check check (memo is null or char_length(memo) <= 300)
);

alter table public.running_records add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.running_records add column if not exists gps_distance_km_raw double precision;
alter table public.running_records add column if not exists gap_adjustment_distance_km double precision;
alter table public.running_records add column if not exists gap_adjustment_seconds double precision;
alter table public.running_records add column if not exists gap_adjustment_count integer;
alter table public.running_records add column if not exists gap_adjustment_auto_enabled boolean;
alter table public.running_records add column if not exists altitude_start_m double precision;
alter table public.running_records add column if not exists altitude_end_m double precision;
alter table public.running_records add column if not exists elevation_gain_m double precision;
alter table public.running_records add column if not exists elevation_loss_m double precision;

alter table public.running_records alter column user_id set default auth.uid();

create index if not exists idx_running_records_created_at on public.running_records (created_at desc);
create index if not exists idx_running_records_user_created_at on public.running_records (user_id, created_at desc);

alter table public.running_records enable row level security;

drop policy if exists "Allow all" on public.running_records;
drop policy if exists "running_records_select_own" on public.running_records;
drop policy if exists "running_records_insert_own" on public.running_records;
drop policy if exists "running_records_update_own" on public.running_records;
drop policy if exists "running_records_delete_own" on public.running_records;

create policy "running_records_select_own"
  on public.running_records
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "running_records_insert_own"
  on public.running_records
  for insert
  to authenticated
  with check (coalesce(user_id, auth.uid()) = auth.uid());

create policy "running_records_update_own"
  on public.running_records
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "running_records_delete_own"
  on public.running_records
  for delete
  to authenticated
  using (user_id = auth.uid());

-- user_profiles --------------------------------------------------------------
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weight numeric not null check (weight >= 20 and weight <= 300),
  height numeric not null check (height >= 100 and height <= 250),
  age integer not null check (age >= 1 and age <= 120),
  weekly_goal_km numeric not null check (weekly_goal_km >= 1 and weekly_goal_km <= 500),
  auto_pause boolean not null default true,
  auto_apply_gap_adjustment boolean not null default false,
  tuning_auto_pause_stop_speed_ms double precision not null default 0.45,
  tuning_auto_pause_resume_speed_ms double precision not null default 0.9,
  tuning_auto_pause_stillness_ms integer not null default 4500,
  tuning_auto_pause_min_move_km double precision not null default 0.0003,
  tuning_off_route_threshold_km double precision not null default 0.06,
  tuning_off_route_sustain_ms integer not null default 10000,
  tuning_off_route_alert_cooldown_ms integer not null default 90000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_tuning_stop_speed_check check (tuning_auto_pause_stop_speed_ms >= 0.2 and tuning_auto_pause_stop_speed_ms <= 1.2),
  constraint user_profiles_tuning_resume_speed_check check (tuning_auto_pause_resume_speed_ms >= 0.3 and tuning_auto_pause_resume_speed_ms <= 2.0),
  constraint user_profiles_tuning_stillness_check check (tuning_auto_pause_stillness_ms >= 2000 and tuning_auto_pause_stillness_ms <= 12000),
  constraint user_profiles_tuning_min_move_check check (tuning_auto_pause_min_move_km >= 0.0001 and tuning_auto_pause_min_move_km <= 0.002),
  constraint user_profiles_tuning_off_route_threshold_check check (tuning_off_route_threshold_km >= 0.02 and tuning_off_route_threshold_km <= 0.2),
  constraint user_profiles_tuning_off_route_sustain_check check (tuning_off_route_sustain_ms >= 3000 and tuning_off_route_sustain_ms <= 30000),
  constraint user_profiles_tuning_off_route_cooldown_check check (tuning_off_route_alert_cooldown_ms >= 10000 and tuning_off_route_alert_cooldown_ms <= 300000)
);

alter table public.user_profiles add column if not exists tuning_auto_pause_stop_speed_ms double precision not null default 0.45;
alter table public.user_profiles add column if not exists tuning_auto_pause_resume_speed_ms double precision not null default 0.9;
alter table public.user_profiles add column if not exists tuning_auto_pause_stillness_ms integer not null default 4500;
alter table public.user_profiles add column if not exists tuning_auto_pause_min_move_km double precision not null default 0.0003;
alter table public.user_profiles add column if not exists tuning_off_route_threshold_km double precision not null default 0.06;
alter table public.user_profiles add column if not exists tuning_off_route_sustain_ms integer not null default 10000;
alter table public.user_profiles add column if not exists tuning_off_route_alert_cooldown_ms integer not null default 90000;

alter table public.user_profiles drop constraint if exists user_profiles_tuning_stop_speed_check;
alter table public.user_profiles add constraint user_profiles_tuning_stop_speed_check check (tuning_auto_pause_stop_speed_ms >= 0.2 and tuning_auto_pause_stop_speed_ms <= 1.2);
alter table public.user_profiles drop constraint if exists user_profiles_tuning_resume_speed_check;
alter table public.user_profiles add constraint user_profiles_tuning_resume_speed_check check (tuning_auto_pause_resume_speed_ms >= 0.3 and tuning_auto_pause_resume_speed_ms <= 2.0);
alter table public.user_profiles drop constraint if exists user_profiles_tuning_stillness_check;
alter table public.user_profiles add constraint user_profiles_tuning_stillness_check check (tuning_auto_pause_stillness_ms >= 2000 and tuning_auto_pause_stillness_ms <= 12000);
alter table public.user_profiles drop constraint if exists user_profiles_tuning_min_move_check;
alter table public.user_profiles add constraint user_profiles_tuning_min_move_check check (tuning_auto_pause_min_move_km >= 0.0001 and tuning_auto_pause_min_move_km <= 0.002);
alter table public.user_profiles drop constraint if exists user_profiles_tuning_off_route_threshold_check;
alter table public.user_profiles add constraint user_profiles_tuning_off_route_threshold_check check (tuning_off_route_threshold_km >= 0.02 and tuning_off_route_threshold_km <= 0.2);
alter table public.user_profiles drop constraint if exists user_profiles_tuning_off_route_sustain_check;
alter table public.user_profiles add constraint user_profiles_tuning_off_route_sustain_check check (tuning_off_route_sustain_ms >= 3000 and tuning_off_route_sustain_ms <= 30000);
alter table public.user_profiles drop constraint if exists user_profiles_tuning_off_route_cooldown_check;
alter table public.user_profiles add constraint user_profiles_tuning_off_route_cooldown_check check (tuning_off_route_alert_cooldown_ms >= 10000 and tuning_off_route_alert_cooldown_ms <= 300000);

alter table public.user_profiles alter column user_id set default auth.uid();

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
drop policy if exists "user_profiles_insert_own" on public.user_profiles;
drop policy if exists "user_profiles_update_own" on public.user_profiles;

create policy "user_profiles_select_own"
  on public.user_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_profiles_insert_own"
  on public.user_profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "user_profiles_update_own"
  on public.user_profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- legacy claim RPC -----------------------------------------------------------
create or replace function public.count_unclaimed_legacy_records()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.running_records
  where user_id is null;
$$;

create or replace function public.claim_legacy_records(limit_count integer default 200)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authenticated user required';
  end if;

  with target as (
    select id
    from public.running_records
    where user_id is null
    order by created_at asc
    limit greatest(limit_count, 0)
    for update skip locked
  )
  update public.running_records rr
  set user_id = auth.uid()
  from target
  where rr.id = target.id;

  get diagnostics claimed_count = row_count;
  return claimed_count;
end;
$$;

grant execute on function public.count_unclaimed_legacy_records() to authenticated;
grant execute on function public.claim_legacy_records(integer) to authenticated;

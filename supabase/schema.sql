-- Run River 테이블 생성 SQL
-- Supabase SQL Editor에서 실행하세요

create table if not exists running_records (
  id uuid default gen_random_uuid() primary key,
  start_point jsonb not null,    -- { lat, lng }
  end_point jsonb not null,      -- { lat, lng }
  distance_km float not null default 0,
  duration_seconds int not null default 0,
  pace float not null default 0, -- 분/km
  activity_type text not null default 'running' check (activity_type in ('running', 'walking')),
  altitude_start_m float,
  altitude_end_m float,
  elevation_gain_m float,
  elevation_loss_m float,
  memo text,
  constraint running_records_memo_len_check check (memo is null or char_length(memo) <= 300),
  created_at timestamptz default now() not null
);

-- RLS 정책 (비로그인 허용 - 개인용 앱)
alter table running_records enable row level security;

create policy "Allow all" on running_records
  for all using (true) with check (true);

alter table running_records add column if not exists altitude_start_m float;
alter table running_records add column if not exists altitude_end_m float;
alter table running_records add column if not exists elevation_gain_m float;
alter table running_records add column if not exists elevation_loss_m float;

-- 인덱스
create index if not exists idx_running_records_created_at
  on running_records (created_at desc);

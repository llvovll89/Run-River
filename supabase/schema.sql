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
  created_at timestamptz default now() not null
);

-- RLS 정책 (비로그인 허용 - 개인용 앱)
alter table running_records enable row level security;

create policy "Allow all" on running_records
  for all using (true) with check (true);

-- 인덱스
create index if not exists idx_running_records_created_at
  on running_records (created_at desc);

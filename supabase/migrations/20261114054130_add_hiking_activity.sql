-- Existing running/walking records and owner policies are preserved.
begin;
alter table public.running_records drop constraint if exists running_records_activity_type_check;
alter table public.running_records add constraint running_records_activity_type_check
  check (activity_type in ('running', 'walking', 'hiking'));
commit;

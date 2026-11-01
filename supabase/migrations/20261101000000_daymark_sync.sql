create table if not exists public.daymark_sync_records (
  user_id uuid not null default auth.uid(),
  key text not null,
  value jsonb,
  deleted boolean not null default false,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.daymark_sync_records enable row level security;

revoke all on public.daymark_sync_records from anon, authenticated;
grant select, insert on public.daymark_sync_records to authenticated;
grant update (value, deleted) on public.daymark_sync_records to authenticated;

drop policy if exists "Daymark users read their own records" on public.daymark_sync_records;
create policy "Daymark users read their own records"
  on public.daymark_sync_records for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Daymark users create their own records" on public.daymark_sync_records;
create policy "Daymark users create their own records"
  on public.daymark_sync_records for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Daymark users update their own records" on public.daymark_sync_records;
create policy "Daymark users update their own records"
  on public.daymark_sync_records for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.daymark_increment_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists daymark_sync_records_increment_revision on public.daymark_sync_records;
create trigger daymark_sync_records_increment_revision
  before update on public.daymark_sync_records
  for each row execute function public.daymark_increment_revision();

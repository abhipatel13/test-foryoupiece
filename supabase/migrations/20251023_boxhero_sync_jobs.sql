-- BoxHero background sync jobs
create table if not exists public.boxhero_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  triggered_by text,
  total_items int not null default 0,
  processed_items int not null default 0,
  updated_items int not null default 0,
  skipped_items int not null default 0,
  cursor text,
  error text
);

create index if not exists idx_boxhero_jobs_status on public.boxhero_sync_jobs(status);
create index if not exists idx_boxhero_jobs_created_at on public.boxhero_sync_jobs(created_at desc);

create or replace function public._bh_jobs_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if (new.status in ('completed','failed') and (old.status is distinct from new.status)) then
    new.completed_at := now();
  end if;
  return new;
end; $$;

drop trigger if exists trg_bh_jobs_updated_at on public.boxhero_sync_jobs;
create trigger trg_bh_jobs_updated_at
before update on public.boxhero_sync_jobs
for each row execute function public._bh_jobs_set_updated_at();

alter table public.boxhero_sync_jobs enable row level security;

create policy "bh_jobs_service_full" on public.boxhero_sync_jobs
for all using (auth.role() = 'service_role');

create policy "bh_jobs_auth_read" on public.boxhero_sync_jobs
for select using (auth.role() = 'authenticated');

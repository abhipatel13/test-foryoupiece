-- CAPI Event Queue and Logs
-- Safe to run multiple times; use IF NOT EXISTS

create table if not exists public.capi_event_queue (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  event_name text not null,
  event_id text not null,
  order_id uuid not null,
  consent boolean not null default false,

  -- Cached payload to make retries self-sufficient
  payload jsonb not null,

  attempts int not null default 0,
  status text not null default 'queued' check (status in ('queued','processing','sent','failed')),
  next_attempt_at timestamptz not null default now(),
  last_error text
);

create table if not exists public.capi_event_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  queue_id uuid not null references public.capi_event_queue(id) on delete cascade,
  attempt int not null,
  status_code int,

  request jsonb,
  response jsonb
);

-- Helpful indexes
create index if not exists idx_capi_queue_status_next on public.capi_event_queue(status, next_attempt_at);
create index if not exists idx_capi_queue_order on public.capi_event_queue(order_id);
create index if not exists idx_capi_logs_queue on public.capi_event_logs(queue_id);

-- Trigger to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists trg_capi_queue_updated_at on public.capi_event_queue;
create trigger trg_capi_queue_updated_at
before update on public.capi_event_queue
for each row execute function public.set_updated_at();


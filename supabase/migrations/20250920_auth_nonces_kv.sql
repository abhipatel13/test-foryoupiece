-- 20250920_auth_nonces_kv.sql
-- Stateless Telegram deep-link nonce storage

-- Create table for login nonces (stateless across cold starts)
create table if not exists public.auth_nonces (
  nonce text primary key,
  created_at timestamptz not null default now(),
  verified boolean not null default false,
  telegram_data jsonb
);

-- Index to help with cleanup/queries by time
create index if not exists auth_nonces_created_at_idx on public.auth_nonces(created_at);

-- (Optional) Enable RLS but without public policies since only service role touches it
-- alter table public.auth_nonces enable row level security;
-- No policies are added; service role bypasses RLS.

comment on table public.auth_nonces is 'Ephemeral login nonces for Telegram deep-link auth (10-minute TTL enforced in code)';


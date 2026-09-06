-- Stores each Apple-signed-in user's Apple refresh token so delete-account
-- can revoke their "Sign in with Apple" authorization on account deletion
-- (Apple Guideline 5.1.1(v)). Service-role only — RLS is enabled with zero
-- policies, so anon/authenticated can never read or write this table; only
-- edge functions using the service role key can (same pattern as ai_usage).
create table if not exists public.apple_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.apple_tokens enable row level security;

-- Server-side subscription plan, written ONLY by the revenuecat-webhook edge
-- function (service role). Lets ai-coach / analyze-photo apply tier-aware
-- rate limits instead of one universal cap (see ai_usage migration note).
--
-- RevenueCat is the source of truth; the webhook mirrors entitlement changes
-- here. app_user_id == Supabase auth user id (set via logInPurchases client-side).

create table if not exists public.subscriptions (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  plan       text not null default 'free' check (plan in ('free', 'pro', 'elite')),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Users may read their own plan row (edge functions query it with the caller's
-- JWT; clients may also read it for display/debugging).
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies: clients cannot write. The webhook edge
-- function uses the service role key, which bypasses RLS.

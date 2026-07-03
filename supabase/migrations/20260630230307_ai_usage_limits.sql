-- AI usage rate limiting
-- Tracks per-user daily AI call counts so the ai-coach and analyze-photo
-- edge functions can cap usage and protect against unbounded Anthropic spend.
--
-- NOTE on tiers: the user's subscription plan (free/pro/elite) is currently
-- managed client-side via RevenueCat and is NOT persisted server-side, so the
-- edge functions pass a single default cap today. To make caps tier-aware,
-- persist the plan in a server-side table (e.g. profiles.plan) and pass a
-- plan-derived p_limit from the edge functions. The infra below already
-- accepts an arbitrary p_limit, so only the caller needs to change.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default (now() at time zone 'utc')::date,
  count   integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

-- Users may read their own usage row (e.g. to show "X/10 left" in the UI).
drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own"
  on public.ai_usage for select
  using (auth.uid() = user_id);

-- No direct client writes: only the SECURITY DEFINER function below mutates rows.

-- Atomically increment today's counter for the calling user and report whether
-- they are still within the limit. Returns TRUE if the call is allowed (and was
-- counted), FALSE if the limit is already reached (no increment performed).
create or replace function public.check_and_increment_ai_usage(p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'utc')::date;
  v_count integer;
begin
  if v_uid is null then
    return false;
  end if;

  insert into public.ai_usage (user_id, day, count)
    values (v_uid, v_day, 1)
  on conflict (user_id, day) do update
    set count = public.ai_usage.count + 1
    where public.ai_usage.count < p_limit
  returning count into v_count;

  -- v_count is NULL when the ON CONFLICT WHERE blocked the update (limit hit).
  return v_count is not null;
end;
$$;

revoke all on function public.check_and_increment_ai_usage(integer) from public;
grant execute on function public.check_and_increment_ai_usage(integer) to authenticated;

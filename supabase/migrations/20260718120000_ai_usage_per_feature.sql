-- Per-feature AI usage counters
-- Splits the single per-user/day AI counter into independent buckets so chat
-- (ai-coach, incl. weekly report) and photo analysis (analyze-photo) each get
-- their own daily limit, aligned with the limits advertised in the app UI
-- (free: 5 chat / 3 photo per day).
--
-- Existing rows keep feature='chat' via the column default — today's photo
-- calls merge into the chat bucket for one day only, which is acceptable.

alter table public.ai_usage
  add column if not exists feature text not null default 'chat';

alter table public.ai_usage drop constraint ai_usage_pkey;
alter table public.ai_usage add primary key (user_id, day, feature);

-- RLS policy "ai_usage_select_own" is user_id-scoped and unchanged.

-- Two-arg RPC: same atomic upsert as before, keyed by feature.
create or replace function public.check_and_increment_ai_usage(p_limit integer, p_feature text)
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
  if p_feature not in ('chat', 'photo') then
    return false;
  end if;

  insert into public.ai_usage (user_id, day, feature, count)
    values (v_uid, v_day, p_feature, 1)
  on conflict (user_id, day, feature) do update
    set count = public.ai_usage.count + 1
    where public.ai_usage.count < p_limit
  returning count into v_count;

  -- v_count is NULL when the ON CONFLICT WHERE blocked the update (limit hit).
  return v_count is not null;
end;
$$;

-- Keep the one-arg overload as a delegating shim so an edge function deployed
-- against the old signature keeps working during the deploy window.
create or replace function public.check_and_increment_ai_usage(p_limit integer)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.check_and_increment_ai_usage(p_limit, 'chat');
$$;

revoke all on function public.check_and_increment_ai_usage(integer, text) from public;
grant execute on function public.check_and_increment_ai_usage(integer, text) to authenticated;
revoke all on function public.check_and_increment_ai_usage(integer) from public;
grant execute on function public.check_and_increment_ai_usage(integer) to authenticated;

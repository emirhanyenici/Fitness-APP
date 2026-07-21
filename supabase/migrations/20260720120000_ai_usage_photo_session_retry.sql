-- Free retries within one photo-scanning attempt.
-- Free/Pro users get a daily photo-scan quota (public.ai_usage, feature='photo').
-- Previously every accepted request incremented the counter, even a retry of
-- the exact same photo (e.g. a low-confidence result) or a fresh photo taken
-- moments later for the same meal — the client's Snap screen has no way to
-- distinguish "still working on this scan" from "starting a new one".
--
-- session_id is generated once per Snap screen mount (client) and passed on
-- every analyze call made during that mount. The first charged request for a
-- session increments the counter as before; later requests carrying the same
-- session_id are recognized as retries of the same attempt and are free.

alter table public.ai_usage
  add column if not exists session_id text;

create or replace function public.check_and_increment_ai_usage_session(
  p_limit integer, p_feature text, p_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'utc')::date;
  v_existing_session text;
  v_count integer;
begin
  if v_uid is null then
    return false;
  end if;
  if p_feature not in ('chat', 'photo') then
    return false;
  end if;
  if p_session_id is null or length(p_session_id) = 0 then
    return false;
  end if;

  select session_id into v_existing_session
    from public.ai_usage
    where user_id = v_uid and day = v_day and feature = p_feature;

  -- Same scanning attempt already paid for today — free retry.
  if v_existing_session is not null and v_existing_session = p_session_id then
    return true;
  end if;

  insert into public.ai_usage (user_id, day, feature, count, session_id)
    values (v_uid, v_day, p_feature, 1, p_session_id)
  on conflict (user_id, day, feature) do update
    set count = public.ai_usage.count + 1,
        session_id = p_session_id
    where public.ai_usage.count < p_limit
  returning count into v_count;

  -- v_count is NULL when the ON CONFLICT WHERE blocked the update (limit hit).
  return v_count is not null;
end;
$$;

revoke all on function public.check_and_increment_ai_usage_session(integer, text, text) from public;
grant execute on function public.check_and_increment_ai_usage_session(integer, text, text) to authenticated;

-- ============================================================================
-- leaderboard_stats — opt-in global leaderboard (streak / LifeScore / effort)
-- ============================================================================
-- Deliberate exception to this project's usual own-row-only RLS: presence of a
-- row IS the opt-in signal (joining upserts a row, leaving deletes it), so a
-- public SELECT policy is safe — no other user data is exposed, only a
-- self-chosen nickname and three derived numbers. Writes stay own-row-only,
-- same trust model as user_state: the client is already the source of truth
-- for streak/score everywhere else in the app, and a leaderboard is cosmetic
-- (no monetary/quota stakes), so a direct client upsert is enough — no
-- SECURITY DEFINER RPC needed here.
-- ============================================================================

create table if not exists public.leaderboard_stats (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  nickname     text        not null,
  streak       int         not null default 0,
  avg_score    int         not null default 0,   -- 7-day avg LifeScore, 0-100
  effort_score int         not null default 0,   -- 0-100, see services/leaderboardScore.ts
  updated_at   timestamptz not null default now()
);

alter table public.leaderboard_stats enable row level security;

drop policy if exists "leaderboard_stats_select_all" on public.leaderboard_stats;
create policy "leaderboard_stats_select_all" on public.leaderboard_stats
  for select using (true);

drop policy if exists "leaderboard_stats_insert_own" on public.leaderboard_stats;
create policy "leaderboard_stats_insert_own" on public.leaderboard_stats
  for insert with check (auth.uid() = user_id);

drop policy if exists "leaderboard_stats_update_own" on public.leaderboard_stats;
create policy "leaderboard_stats_update_own" on public.leaderboard_stats
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "leaderboard_stats_delete_own" on public.leaderboard_stats;
create policy "leaderboard_stats_delete_own" on public.leaderboard_stats
  for delete using (auth.uid() = user_id);

create or replace function public.set_leaderboard_stats_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_leaderboard_stats_updated_at on public.leaderboard_stats;
create trigger trg_leaderboard_stats_updated_at
  before update on public.leaderboard_stats
  for each row execute function public.set_leaderboard_stats_updated_at();

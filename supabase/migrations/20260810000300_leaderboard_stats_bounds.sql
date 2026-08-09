-- ============================================================================
-- leaderboard_stats — bound values at the DB layer
-- ============================================================================
-- Writes are still direct client upserts (own-row RLS, no SECURITY DEFINER
-- RPC — see the original migration's comment for why that trade-off is
-- accepted for this cosmetic, stakes-free feature). These CHECK constraints
-- add a cheap extra layer: a client can still write any value within range,
-- but can no longer post nonsense like effort_score=99999 or an empty/
-- huge nickname, regardless of what the app's own UI would ever produce.
-- ============================================================================

alter table public.leaderboard_stats
  drop constraint if exists leaderboard_stats_streak_range,
  add  constraint leaderboard_stats_streak_range check (streak between 0 and 36500);

alter table public.leaderboard_stats
  drop constraint if exists leaderboard_stats_avg_score_range,
  add  constraint leaderboard_stats_avg_score_range check (avg_score between 0 and 100);

alter table public.leaderboard_stats
  drop constraint if exists leaderboard_stats_effort_score_range,
  add  constraint leaderboard_stats_effort_score_range check (effort_score between 0 and 100);

alter table public.leaderboard_stats
  drop constraint if exists leaderboard_stats_nickname_length,
  add  constraint leaderboard_stats_nickname_length check (char_length(nickname) between 1 and 20);

-- ============================================================================
-- leaderboard_reports — dedupe repeat reports from the same reporter
-- ============================================================================
-- Without this, a single user could insert unbounded rows against the same
-- target (spam/row-bloat, and a "bury someone in reports" nuisance vector).
-- One row per (reporter, target) pair is enough signal for manual review;
-- re-reporting the same target just bumps created_at via the app's upsert.
-- ============================================================================

alter table public.leaderboard_reports
  add constraint leaderboard_reports_reporter_target_unique
  unique (reporter_id, reported_user_id);

-- The app now upserts (insert ... on conflict do update) so a re-report just
-- bumps created_at instead of erroring — that update path needs its own RLS
-- policy, scoped the same way as the insert policy (own rows only).
drop policy if exists "leaderboard_reports_update_own" on public.leaderboard_reports;
create policy "leaderboard_reports_update_own" on public.leaderboard_reports
  for update using (auth.uid() = reporter_id) with check (auth.uid() = reporter_id);

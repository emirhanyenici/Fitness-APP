-- ============================================================================
-- leaderboard_reports — user-submitted reports of abusive leaderboard nicknames
-- ============================================================================
-- Minimal moderation queue for the public leaderboard (Apple UGC guideline
-- 1.2 requires a report mechanism for public user-generated content). No
-- select policy for authenticated users on purpose — this is a write-only
-- mailbox from the app's perspective; only the developer (Supabase dashboard
-- / service-role) reads it to manually delete abusive leaderboard_stats rows.
-- ============================================================================

create table if not exists public.leaderboard_reports (
  id                bigint generated always as identity primary key,
  reporter_id       uuid not null references auth.users (id) on delete cascade,
  reported_user_id  uuid not null references auth.users (id) on delete cascade,
  reported_nickname text not null,
  created_at        timestamptz not null default now()
);

alter table public.leaderboard_reports enable row level security;

drop policy if exists "leaderboard_reports_insert_own" on public.leaderboard_reports;
create policy "leaderboard_reports_insert_own" on public.leaderboard_reports
  for insert with check (auth.uid() = reporter_id);

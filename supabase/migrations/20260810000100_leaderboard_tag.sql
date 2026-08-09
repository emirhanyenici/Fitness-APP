-- ============================================================================
-- leaderboard_stats.tag — Discord-style disambiguator for duplicate nicknames
-- ============================================================================
-- Nicknames aren't unique (no constraint, free text). Display as "Nickname#tag"
-- (e.g. "Emir#1"), where tag is assigned in join order per nickname
-- (case-insensitive) — the first "Emir" gets #1, the next "emir" gets #2, etc.
-- Assigned once at insert time (first join); a later upsert that only updates
-- stats (same nickname) leaves the existing tag untouched since this trigger
-- only fires BEFORE INSERT, not BEFORE UPDATE.
-- ============================================================================

alter table public.leaderboard_stats add column if not exists tag int not null default 1;

create or replace function public.assign_leaderboard_tag()
returns trigger language plpgsql as $$
begin
  select coalesce(max(tag), 0) + 1 into new.tag
  from public.leaderboard_stats
  where lower(nickname) = lower(new.nickname);
  return new;
end;
$$;

drop trigger if exists trg_assign_leaderboard_tag on public.leaderboard_stats;
create trigger trg_assign_leaderboard_tag
  before insert on public.leaderboard_stats
  for each row execute function public.assign_leaderboard_tag();

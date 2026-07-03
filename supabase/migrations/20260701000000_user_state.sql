-- ============================================================================
-- user_state — per-user cloud backup / cross-device sync for local Zustand stores
-- ============================================================================
-- The app is local-first: every store persists to the device (secureStorage).
-- This table mirrors each store's serialized state as a JSON document, keyed by
-- (user_id, store). Sync is best-effort — the app keeps working offline and
-- pushes/pulls opportunistically (see services/sync.ts).
--
-- One row per (user, store), e.g. store = 'nutrition' | 'workout' | 'recovery'…
-- Subscription plan is intentionally NOT synced here — it is authoritative
-- server-side via RevenueCat, never trusted from the client.
-- ============================================================================

create table if not exists public.user_state (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  store      text        not null,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, store)
);

-- Row Level Security: a user may only read/write their OWN rows.
alter table public.user_state enable row level security;

drop policy if exists "user_state_select_own" on public.user_state;
create policy "user_state_select_own" on public.user_state
  for select using (auth.uid() = user_id);

drop policy if exists "user_state_insert_own" on public.user_state;
create policy "user_state_insert_own" on public.user_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_state_update_own" on public.user_state;
create policy "user_state_update_own" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_state_delete_own" on public.user_state;
create policy "user_state_delete_own" on public.user_state
  for delete using (auth.uid() = user_id);

-- Keep updated_at fresh on every write.
create or replace function public.set_user_state_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_state_updated_at on public.user_state;
create trigger trg_user_state_updated_at
  before update on public.user_state
  for each row execute function public.set_user_state_updated_at();

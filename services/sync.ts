/**
 * Cloud sync for local Zustand stores (best-effort, local-first).
 *
 * The app works fully offline: every store persists to the device. This layer
 * mirrors each store's state to Supabase (`user_state` table, one JSON row per
 * store) so data survives reinstalls and syncs across devices.
 *
 * Strategy (single user per account → last-write-wins):
 *   • On login: pull remote rows and hydrate stores. If the cloud has no row
 *     for a store yet, SEED it from the current local state (never wipe local
 *     data for a first-time-cloud user).
 *   • On any store change: debounced upsert of that store's snapshot.
 *   • On sign-out: stop syncing (authStore already clears local data).
 *
 * Subscription plan is deliberately NOT synced — RevenueCat is authoritative.
 * Failures are logged and swallowed so sync never breaks the app.
 */
import type { StoreApi, UseBoundStore } from 'zustand';
import { supabase } from './supabase';
import { useUserStore } from '../stores/userStore';
import { useNutritionStore } from '../stores/nutritionStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useRecoveryStore } from '../stores/recoveryStore';
import { useWeightLogStore } from '../stores/weightLogStore';
import { useExerciseWeightStore } from '../stores/exerciseWeightStore';
import { useCustomProgramStore } from '../stores/customProgramStore';
import { useAISuggestionsStore } from '../stores/aiSuggestionsStore';
import { useAIChatStore } from '../stores/aiChatStore';

type AnyStore = UseBoundStore<StoreApi<any>>;

interface Adapter {
  /** Row key in user_state.store */
  store: string;
  hook: AnyStore;
  /** Data-only keys to persist (excludes action functions). */
  keys: string[];
}

const ADAPTERS: Adapter[] = [
  { store: 'user',            hook: useUserStore as AnyStore,           keys: ['profile', 'isOnboarded'] },
  { store: 'nutrition',       hook: useNutritionStore as AnyStore,      keys: ['entries', 'waterByDate'] },
  { store: 'workout',         hook: useWorkoutStore as AnyStore,        keys: ['history', 'selectedType', 'selectedProgram'] },
  { store: 'recovery',        hook: useRecoveryStore as AnyStore,       keys: ['entries'] },
  { store: 'weightLog',       hook: useWeightLogStore as AnyStore,      keys: ['entries'] },
  { store: 'exerciseWeight',  hook: useExerciseWeightStore as AnyStore, keys: ['logs'] },
  { store: 'customProgram',   hook: useCustomProgramStore as AnyStore,  keys: ['days'] },
  { store: 'aiSuggestions',   hook: useAISuggestionsStore as AnyStore,  keys: ['nutrition', 'workout'] },
  { store: 'aiChat',          hook: useAIChatStore as AnyStore,         keys: ['chats'] },
];

/** True while applying remote data, so change-subscriptions don't echo it back. */
let hydrating = false;

/** Extract the data-only snapshot for a store. */
function snapshot(a: Adapter): Record<string, unknown> {
  const state = a.hook.getState();
  const out: Record<string, unknown> = {};
  for (const k of a.keys) out[k] = state[k];
  return out;
}

// ─── Push (local → cloud) ─────────────────────────────────────────────────────

async function pushStore(userId: string, a: Adapter): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_state')
      .upsert(
        { user_id: userId, store: a.store, data: snapshot(a), updated_at: new Date().toISOString() },
        { onConflict: 'user_id,store' },
      );
    if (error) console.warn(`[sync] push ${a.store} failed:`, error.message);
  } catch (e: any) {
    console.warn(`[sync] push ${a.store} threw:`, e?.message);
  }
}

// ─── Pull (cloud → local), seeding empty stores ───────────────────────────────

/**
 * Fetch all remote rows for the user and hydrate stores. When the cloud has no
 * row for a store, seed it from the current local state. Skips push-echo while
 * hydrating so applying remote data doesn't immediately bounce back.
 */
export async function pullUserState(userId: string): Promise<void> {
  let remoteByStore = new Map<string, Record<string, unknown>>();
  try {
    const { data, error } = await supabase
      .from('user_state')
      .select('store, data')
      .eq('user_id', userId);
    if (error) { console.warn('[sync] pull failed:', error.message); return; }
    remoteByStore = new Map((data ?? []).map((r: any) => [r.store as string, r.data as Record<string, unknown>]));
  } catch (e: any) {
    console.warn('[sync] pull threw:', e?.message);
    return;
  }

  hydrating = true;
  try {
    for (const a of ADAPTERS) {
      const remote = remoteByStore.get(a.store);
      if (remote && Object.keys(remote).length > 0) {
        a.hook.setState(remote as any);          // cloud is source of truth
      } else {
        await pushStore(userId, a);              // seed cloud from local
      }
    }
  } finally {
    hydrating = false;
  }
}

// ─── Change subscriptions (local → cloud, debounced) ──────────────────────────

let unsubscribers: Array<() => void> = [];
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const PUSH_DEBOUNCE_MS = 1500;

function schedulePush(userId: string, a: Adapter): void {
  if (hydrating) return; // don't echo remote data we just applied
  const existing = timers.get(a.store);
  if (existing) clearTimeout(existing);
  timers.set(a.store, setTimeout(() => { timers.delete(a.store); void pushStore(userId, a); }, PUSH_DEBOUNCE_MS));
}

/** Begin syncing: pull remote, then push on every subsequent store change. */
export async function startSync(userId: string): Promise<void> {
  stopSync(); // guard against double-start (e.g. repeated auth events)
  await pullUserState(userId);
  unsubscribers = ADAPTERS.map((a) => a.hook.subscribe(() => schedulePush(userId, a)));
}

/** Stop syncing and cancel any pending pushes. */
export function stopSync(): void {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
}

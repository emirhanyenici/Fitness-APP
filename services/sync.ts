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
  { store: 'user',            hook: useUserStore as AnyStore,           keys: ['profile', 'isOnboarded', 'freeSnapsUsed', 'freeSnapsDate'] },
  { store: 'nutrition',       hook: useNutritionStore as AnyStore,      keys: ['entries', 'waterByDate'] },
  { store: 'workout',         hook: useWorkoutStore as AnyStore,        keys: ['history', 'selectedType', 'selectedProgram'] },
  { store: 'recovery',        hook: useRecoveryStore as AnyStore,       keys: ['entries'] },
  { store: 'weightLog',       hook: useWeightLogStore as AnyStore,      keys: ['entries'] },
  { store: 'exerciseWeight',  hook: useExerciseWeightStore as AnyStore, keys: ['logs'] },
  { store: 'customProgram',   hook: useCustomProgramStore as AnyStore,  keys: ['days'] },
  { store: 'aiSuggestions',   hook: useAISuggestionsStore as AnyStore,  keys: ['nutrition', 'workout'] },
  { store: 'aiChat',          hook: useAIChatStore as AnyStore,         keys: ['chats', 'dailyCounts'] },
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
 *
 * Returns false when the fetch itself failed — the caller must NOT attach
 * push subscribers in that case: "pull failed" is not "cloud is empty", and
 * pushing on top of an unknown remote state would let a fresh/empty local
 * store overwrite a user's real cloud backup (last-write-wins).
 */
export async function pullUserState(userId: string): Promise<boolean> {
  let remoteByStore = new Map<string, Record<string, unknown>>();
  try {
    const { data, error } = await supabase
      .from('user_state')
      .select('store, data')
      .eq('user_id', userId);
    if (error) { console.warn('[sync] pull failed:', error.message); return false; }
    remoteByStore = new Map((data ?? []).map((r: any) => [r.store as string, r.data as Record<string, unknown>]));
  } catch (e: any) {
    console.warn('[sync] pull threw:', e?.message);
    return false;
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
  return true;
}

// ─── Persist-rehydration gate ─────────────────────────────────────────────────

/**
 * Wait until every synced store has finished rehydrating from disk.
 *
 * Each store's `persist` middleware loads from secureStorage asynchronously
 * and independently of the cloud pull. Pulling before rehydration completes
 * is a race: the pull applies remote data, then the (older) disk snapshot
 * resolves and overwrites it in memory. The `hydrating` flag only stops
 * push echoes — it cannot stop persist's own setState — so we simply wait.
 */
async function waitForStoreHydration(timeoutMs = 5000): Promise<void> {
  await Promise.all(ADAPTERS.map((a) => {
    const p = (a.hook as any).persist;
    if (!p || p.hasHydrated()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => { unsub(); resolve(); }, timeoutMs); // never hang login on a stuck disk read
      const unsub = p.onFinishHydration(() => { clearTimeout(timer); unsub(); resolve(); });
    });
  }));
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

/** Invalidated by stopSync so an in-flight start/retry aborts cleanly. */
let syncGeneration = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/** Pull, and only on success attach push subscribers; otherwise retry with backoff. */
async function beginSync(userId: string, gen: number, attempt: number): Promise<void> {
  const ok = await pullUserState(userId);
  if (gen !== syncGeneration) return; // stopped or restarted while pulling

  if (ok) {
    unsubscribers = ADAPTERS.map((a) => a.hook.subscribe(() => schedulePush(userId, a)));
    return;
  }

  // Pull failed (flaky network, server error): keep sync OFF — attaching
  // subscribers now could push empty local state over the cloud backup —
  // and retry until it succeeds or the session ends.
  const delay = Math.min(60_000, 5_000 * 2 ** attempt); // 5s → 10s → 20s → 40s → 60s cap
  console.warn(`[sync] pull failed; sync paused, retrying in ${delay / 1000}s`);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void beginSync(userId, gen, attempt + 1);
  }, delay);
}

/** Begin syncing: pull remote, then push on every subsequent store change. */
export async function startSync(userId: string): Promise<void> {
  stopSync(); // guard against double-start (e.g. repeated auth events)
  const gen = syncGeneration;
  await waitForStoreHydration(); // never pull under a pending disk rehydrate
  if (gen !== syncGeneration) return;
  await beginSync(userId, gen, 0);
}

/** Stop syncing and cancel any pending pushes/retries. */
export function stopSync(): void {
  syncGeneration++;
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
}

/**
 * Persistent cache for exercise demo lookups (name → ExerciseDemo | null).
 *
 * The app's exercise catalog is a fixed set of ~50 hardcoded names, so caching
 * each lookup means the ExerciseDB free-tier quota is only spent once per
 * exercise per month — repeat opens are free and instant. Negative results
 * ("no demo exists") are cached too, with a shorter TTL so a later catalog or
 * alias-map fix can still surface a demo.
 *
 * Plain module (not a zustand store): no UI needs to react to the cache, and
 * this avoids rehydrating the whole map on every app start for a feature most
 * sessions never touch. Loaded lazily on first lookup.
 */
import { secureStorage } from './secureStorage';
import { logError } from './monitoring';
import type { ExerciseDemo } from './exercisedb';

const CACHE_KEY = 'zenova-exercise-demo-cache';
const POSITIVE_TTL_MS = 30 * 86_400_000; // gif CDN urls are stable
const NEGATIVE_TTL_MS = 7 * 86_400_000;
const MAX_ENTRIES = 200; // safety valve; catalog is ~50 names

export interface CachedDemo {
  demo: ExerciseDemo | null; // null = known miss → show placeholder + YouTube
  ts: number;
  /** Optional TTL override in ms (e.g. short-lived wger fallback results). */
  ttl?: number;
}

let memory: Map<string, CachedDemo> | null = null;
let loading: Promise<Map<string, CachedDemo>> | null = null;

async function load(): Promise<Map<string, CachedDemo>> {
  if (memory) return memory;
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await secureStorage.getItem(CACHE_KEY);
        memory = new Map(raw ? (JSON.parse(raw) as [string, CachedDemo][]) : []);
      } catch (e) {
        logError(e, { scope: 'exerciseDemoCache', op: 'load' });
        memory = new Map();
      }
      return memory;
    })();
  }
  return loading;
}

function persist(map: Map<string, CachedDemo>): void {
  secureStorage
    .setItem(CACHE_KEY, JSON.stringify([...map.entries()]))
    .catch((e) => logError(e, { scope: 'exerciseDemoCache', op: 'persist' }));
}

function ttlFor(entry: CachedDemo): number {
  if (entry.ttl) return entry.ttl;
  return entry.demo ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
}

/** Returns the cached result, or undefined when absent/expired. */
export async function getCachedDemo(key: string): Promise<CachedDemo | undefined> {
  const map = await load();
  const entry = map.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > ttlFor(entry)) {
    map.delete(key);
    persist(map);
    return undefined;
  }
  return entry;
}

export async function setCachedDemo(
  key: string,
  demo: ExerciseDemo | null,
  ttl?: number,
): Promise<void> {
  const map = await load();
  map.set(key, { demo, ts: Date.now(), ...(ttl ? { ttl } : {}) });
  if (map.size > MAX_ENTRIES) {
    const oldest = [...map.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) map.delete(oldest[0]);
  }
  persist(map);
}

/** Test-only: reset module state. */
export function _clearDemoCacheForTests(): void {
  memory = null;
  loading = null;
}

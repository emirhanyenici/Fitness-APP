/**
 * Apple Health (HealthKit) integration — iOS only, read-only.
 *
 * The @kingstinct/react-native-healthkit native module is loaded lazily so
 * platforms without it (Android, web, Jest, or a dev build made before this
 * feature) never touch it — same pattern as services/appleAuth.ts. Callers
 * gate UI on isHealthKitSupported().
 *
 * Data flow (last 7 days, re-runs on Home mount + pull-to-refresh):
 *  - steps  → healthStore.stepsByDate   (Home "Steps" stat tile)
 *  - sleep  → healthStore.sleepByDate   (recovery check-in prefill)
 *  - weight → weightLogStore            (manual entries win per date)
 *  - workouts → workoutStore.history    (id `hk-{uuid}` — deduped across syncs)
 */
import { Platform } from 'react-native';
import { dateStr, daysAgoStr } from './dateUtils';
import { logError } from './monitoring';
import { useHealthStore } from '../stores/healthStore';
import { useWeightLogStore } from '../stores/weightLogStore';
import { useWorkoutStore, type CompletedWorkout } from '../stores/workoutStore';

const READ_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierBodyMass',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKWorkoutTypeIdentifier',
] as const;

const SYNC_DAYS = 7;

type HK = typeof import('@kingstinct/react-native-healthkit');

async function loadModule(): Promise<HK | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    return await import('@kingstinct/react-native-healthkit');
  } catch {
    return null; // native module absent (old dev build) — feature stays hidden
  }
}

/** Whether the device can offer Apple Health at all (iOS + module + HealthKit). */
export async function isHealthKitSupported(): Promise<boolean> {
  const hk = await loadModule();
  if (!hk) return false;
  try {
    return await hk.isHealthDataAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Shows the HealthKit authorization sheet and, on success, marks the store
 * connected and runs a first sync. Returns false when unsupported (Apple does
 * not report per-type read denials — a "connected" user may still have every
 * toggle off, which simply yields empty query results).
 */
export async function connectAppleHealth(): Promise<boolean> {
  const hk = await loadModule();
  if (!hk) return false;
  try {
    await hk.requestAuthorization({ toRead: [...READ_TYPES] });
    useHealthStore.getState().setConnected(true);
    await syncHealthData();
    return true;
  } catch (e) {
    logError(e, { scope: 'healthkit.connect' });
    return false;
  }
}

/** Disconnect = stop reading + drop cached data. (iOS keeps the permission; the
 *  user can also revoke it in Settings → Health.) */
export function disconnectAppleHealth(): void {
  useHealthStore.getState().clearAll();
}

// ── Pure mapping helpers (exported for tests) ────────────────────────────────

interface Interval { start: number; end: number }

/** HKCategoryValueSleepAnalysis values that count as actually asleep
 *  (unspecified/core/deep/REM — not inBed=0, not awake=2). */
const ASLEEP_VALUES = new Set([1, 3, 4, 5]);

/**
 * Sums sleep sample intervals into hours per local day (keyed by the morning
 * the sleep ENDED). Overlapping samples — iPhone and Watch both recording —
 * are merged so shared time counts once.
 */
export function sleepHoursByDate(
  samples: readonly { startDate: Date; endDate: Date; value: number }[],
): Record<string, number> {
  const byDate: Record<string, Interval[]> = {};
  for (const s of samples) {
    if (!ASLEEP_VALUES.has(s.value)) continue;
    const start = s.startDate.getTime();
    const end = s.endDate.getTime();
    if (!(end > start)) continue;
    const day = dateStr(s.endDate);
    (byDate[day] ??= []).push({ start, end });
  }

  const out: Record<string, number> = {};
  for (const [day, intervals] of Object.entries(byDate)) {
    intervals.sort((a, b) => a.start - b.start);
    let ms = 0;
    let cur = { ...intervals[0] };
    for (let i = 1; i < intervals.length; i++) {
      const iv = intervals[i];
      if (iv.start <= cur.end) {
        cur.end = Math.max(cur.end, iv.end);
      } else {
        ms += cur.end - cur.start;
        cur = { ...iv };
      }
    }
    ms += cur.end - cur.start;
    const hours = Math.round((ms / 3_600_000) * 10) / 10;
    if (hours > 0) out[day] = Math.min(hours, 24);
  }
  return out;
}

/** Human names for the workout activity types users realistically log. */
const ACTIVITY_NAMES: Record<number, string> = {
  13: 'Cycling',
  16: 'Elliptical',
  20: 'Strength Training',
  24: 'Hiking',
  29: 'Mind & Body',
  30: 'Mixed Cardio',
  35: 'Rowing',
  37: 'Running',
  44: 'Stair Climbing',
  46: 'Swimming',
  50: 'Strength Training',
  52: 'Walking',
  57: 'Yoga',
  59: 'Core Training',
  62: 'Flexibility',
  63: 'HIIT',
  64: 'Jump Rope',
  65: 'Kickboxing',
  66: 'Pilates',
  72: 'Tai Chi',
  73: 'Mixed Cardio',
  77: 'Dance',
};

export interface HKWorkoutLike {
  uuid: string;
  workoutActivityType: number;
  startDate: Date;
  endDate: Date;
  /** seconds */
  duration?: { quantity: number };
  /** kcal */
  totalEnergyBurned?: { quantity: number };
}

/**
 * Maps an Apple Health workout onto the app's CompletedWorkout shape. The
 * `hk-{uuid}` id keeps re-imports idempotent (importWorkouts dedupes on id).
 */
export function mapHKWorkout(w: HKWorkoutLike): CompletedWorkout {
  const minutes = Math.round(
    (w.duration?.quantity ?? (w.endDate.getTime() - w.startDate.getTime()) / 1000) / 60,
  );
  return {
    id: `hk-${w.uuid}`,
    name: ACTIVITY_NAMES[w.workoutActivityType] ?? 'Workout',
    programName: 'Apple Health',
    icon: '⌚',
    bodyPart: 'full body',
    duration: `${minutes} min`,
    durationMinutes: minutes,
    calories: Math.round(w.totalEnergyBurned?.quantity ?? 0),
    exercisesDone: 0,
    exercisesTotal: 0,
    date: dateStr(w.startDate),
    timestamp: w.endDate.getTime(),
  };
}

// ── Sync ─────────────────────────────────────────────────────────────────────

let syncInFlight = false;

/**
 * Pulls the last 7 days from HealthKit into the stores. Safe to call anywhere:
 * no-ops unless connected on iOS with the module present. Each metric fails
 * independently (a denied read permission must not block the others).
 */
export async function syncHealthData(): Promise<void> {
  if (!useHealthStore.getState().connected) return;
  const hk = await loadModule();
  if (!hk || syncInFlight) return;
  syncInFlight = true;

  const now = new Date();
  const from = new Date();
  from.setDate(from.getDate() - SYNC_DAYS);
  from.setHours(0, 0, 0, 0);

  const steps: Record<string, number> = {};
  const sleep: Record<string, number> = {};

  try {
    // Steps: one cumulative sum per local day.
    try {
      const buckets = await hk.queryStatisticsCollectionForQuantity(
        'HKQuantityTypeIdentifierStepCount',
        ['cumulativeSum'],
        from,
        { day: 1 },
        { unit: 'count', filter: { date: { startDate: from, endDate: now } } },
      );
      for (const b of buckets) {
        const sum = b.sumQuantity?.quantity ?? 0;
        if (b.startDate && sum > 0) steps[dateStr(new Date(b.startDate))] = Math.round(sum);
      }
    } catch (e) {
      logError(e, { scope: 'healthkit.sync.steps' });
    }

    // Sleep: asleep intervals keyed to the morning they end. Query one extra
    // day back so a night that started before the window still counts fully.
    try {
      const sleepFrom = new Date(from);
      sleepFrom.setDate(sleepFrom.getDate() - 1);
      const samples = await hk.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
        limit: 0,
        filter: { date: { startDate: sleepFrom, endDate: now } },
      });
      Object.assign(
        sleep,
        sleepHoursByDate(
          samples.map((s) => ({
            startDate: new Date(s.startDate),
            endDate: new Date(s.endDate),
            value: s.value as number,
          })),
        ),
      );
    } catch (e) {
      logError(e, { scope: 'healthkit.sync.sleep' });
    }

    // Weight: latest sample per day → weightLogStore (existing dates win).
    try {
      const samples = await hk.queryQuantitySamples('HKQuantityTypeIdentifierBodyMass', {
        limit: 0,
        ascending: true,
        unit: 'kg',
        filter: { date: { startDate: from, endDate: now } },
      });
      const perDay: Record<string, number> = {};
      for (const s of samples) {
        perDay[dateStr(new Date(s.endDate))] = Math.round(s.quantity * 10) / 10;
      }
      useWeightLogStore.getState().importEntries(
        Object.entries(perDay).map(([date, weight_kg]) => ({ date, weight_kg })),
      );
    } catch (e) {
      logError(e, { scope: 'healthkit.sync.weight' });
    }

    // Workouts → workout history (idempotent via hk-uuid ids).
    try {
      const workouts = await hk.queryWorkoutSamples({
        limit: 0,
        filter: { date: { startDate: from, endDate: now } },
      });
      const mapped = workouts
        .map((w) =>
          mapHKWorkout({
            uuid: w.uuid,
            workoutActivityType: w.workoutActivityType as number,
            startDate: new Date(w.startDate),
            endDate: new Date(w.endDate),
            duration: w.duration,
            totalEnergyBurned: w.totalEnergyBurned,
          }),
        )
        .filter((w) => w.durationMinutes !== undefined && w.durationMinutes >= 1);
      useWorkoutStore.getState().importWorkouts(mapped);
    } catch (e) {
      logError(e, { scope: 'healthkit.sync.workouts' });
    }

    useHealthStore.getState().applySync(steps, sleep);
  } finally {
    syncInFlight = false;
  }
}

/** Sleep hours HealthKit recorded for the night ending on `date` (today by default). */
export function healthSleepFor(date?: string): number | undefined {
  const d = date ?? daysAgoStr(0);
  return useHealthStore.getState().sleepByDate[d];
}

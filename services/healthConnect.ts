/**
 * Android Health Connect integration — read-only, mirrors services/healthkit.ts.
 *
 * react-native-health-connect is loaded lazily so platforms without the native
 * module (iOS, web, Jest, or a dev build made before this feature) never touch
 * it. Data lands in the same places as the iOS path: steps/sleep/calories/
 * distance/exerciseMin in healthStore, weight in weightLogStore, exercise
 * sessions in workoutStore (id `hc-{recordId}` keeps re-imports idempotent).
 * Health Connect has no per-day "exercise time" aggregate like Apple's, so
 * exerciseMin is derived by summing ExerciseSession durations per local day.
 */
import { Platform } from 'react-native';
import { dateStr } from './dateUtils';
import { logError } from './monitoring';
import { sleepHoursByDate } from './healthkit';
import { useHealthStore } from '../stores/healthStore';
import { useWeightLogStore } from '../stores/weightLogStore';
import { useWorkoutStore, type CompletedWorkout } from '../stores/workoutStore';

const SYNC_DAYS = 7;

const READ_PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'Distance' },
] as const;

type HC = typeof import('react-native-health-connect');

async function loadModule(): Promise<HC | null> {
  if (Platform.OS !== 'android') return null;
  try {
    return await import('react-native-health-connect');
  } catch {
    return null; // native module absent (old dev build) — feature stays hidden
  }
}

/** Whether Health Connect is installed and ready on this device (SDK_AVAILABLE). */
export async function isHealthConnectSupported(): Promise<boolean> {
  const hc = await loadModule();
  if (!hc) return false;
  try {
    return (await hc.getSdkStatus()) === hc.SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

/**
 * Opens the Health Connect permission screen and, when at least one read
 * permission is granted, marks the store connected and runs a first sync.
 */
export async function connectHealthConnect(): Promise<boolean> {
  const hc = await loadModule();
  if (!hc) return false;
  try {
    const ok = await hc.initialize();
    if (!ok) return false;
    const granted = await hc.requestPermission([...READ_PERMISSIONS]);
    if (!granted || granted.length === 0) return false;
    useHealthStore.getState().setConnected(true);
    await syncHealthConnectData();
    return true;
  } catch (e) {
    logError(e, { scope: 'healthConnect.connect' });
    return false;
  }
}

/** Disconnect = stop reading + drop cached data (permissions stay granted in
 *  the Health Connect app until the user revokes them there). */
export function disconnectHealthConnect(): void {
  useHealthStore.getState().clearAll();
}

// ── Pure mapping helpers (exported for tests) ────────────────────────────────

/** SleepSessionRecord.Stage values that count as actually asleep:
 *  2 SLEEPING, 4 LIGHT, 5 DEEP, 6 REM (not 1 AWAKE, 3 OUT_OF_BED, 7 AWAKE_IN_BED). */
const HC_ASLEEP_STAGES = new Set([2, 4, 5, 6]);

export interface HCSleepSessionLike {
  startTime: string;
  endTime: string;
  stages?: { startTime: string; endTime: string; stage: number }[];
}

/**
 * Flattens Health Connect sleep sessions into asleep intervals compatible with
 * sleepHoursByDate (value 1 = asleep). Sessions with stage data contribute only
 * their asleep stages; stage-less sessions count whole.
 */
export function hcSleepIntervals(
  sessions: readonly HCSleepSessionLike[],
): { startDate: Date; endDate: Date; value: number }[] {
  const out: { startDate: Date; endDate: Date; value: number }[] = [];
  for (const s of sessions) {
    const stages = (s.stages ?? []).filter((st) => HC_ASLEEP_STAGES.has(st.stage));
    if (stages.length > 0) {
      for (const st of stages) {
        out.push({ startDate: new Date(st.startTime), endDate: new Date(st.endTime), value: 1 });
      }
    } else {
      out.push({ startDate: new Date(s.startTime), endDate: new Date(s.endTime), value: 1 });
    }
  }
  return out;
}

/** Human names for common Health Connect ExerciseType values. */
const HC_EXERCISE_NAMES: Record<number, string> = {
  8: 'Cycling',
  9: 'Cycling',
  10: 'Boot Camp',
  11: 'Boxing',
  13: 'Calisthenics',
  16: 'Dance',
  25: 'Elliptical',
  26: 'Exercise Class',
  36: 'HIIT',
  37: 'Hiking',
  41: 'Jump Rope',
  44: 'Martial Arts',
  48: 'Pilates',
  53: 'Rowing',
  54: 'Rowing',
  56: 'Running',
  57: 'Running',
  68: 'Stair Climbing',
  69: 'Stair Climbing',
  70: 'Strength Training',
  71: 'Stretching',
  73: 'Swimming',
  74: 'Swimming',
  79: 'Walking',
  81: 'Strength Training',
  83: 'Yoga',
};

export interface HCExerciseLike {
  id: string;
  exerciseType: number;
  startTime: string;
  endTime: string;
  title?: string;
}

/** Maps a Health Connect exercise session onto the app's CompletedWorkout
 *  shape. Calories are unknown at session level in HC — recorded as 0. */
export function mapHCWorkout(w: HCExerciseLike): CompletedWorkout {
  const start = new Date(w.startTime);
  const end = new Date(w.endTime);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  return {
    id: `hc-${w.id}`,
    name: w.title?.trim() || HC_EXERCISE_NAMES[w.exerciseType] || 'Workout',
    programName: 'Health Connect',
    icon: '⌚',
    bodyPart: 'full body',
    duration: `${minutes} min`,
    durationMinutes: minutes,
    calories: 0,
    exercisesDone: 0,
    exercisesTotal: 0,
    date: dateStr(start),
    timestamp: end.getTime(),
  };
}

// ── Sync ─────────────────────────────────────────────────────────────────────

let syncInFlight = false;

/**
 * Pulls the last 7 days from Health Connect into the stores. Safe to call
 * anywhere: no-ops unless connected on Android with the module present. Each
 * metric fails independently (a denied permission must not block the others).
 */
export async function syncHealthConnectData(): Promise<void> {
  if (!useHealthStore.getState().connected) return;
  const hc = await loadModule();
  if (!hc || syncInFlight) return;
  syncInFlight = true;

  const now = new Date();
  const from = new Date();
  from.setDate(from.getDate() - SYNC_DAYS);
  from.setHours(0, 0, 0, 0);
  const range = {
    operator: 'between' as const,
    startTime: from.toISOString(),
    endTime: now.toISOString(),
  };

  const steps: Record<string, number> = {};
  const sleep: Record<string, number> = {};
  const calories: Record<string, number> = {};
  const distance: Record<string, number> = {};
  const exerciseMin: Record<string, number> = {};

  try {
    await hc.initialize();

    // Steps: platform-deduped daily totals via aggregateGroupByPeriod.
    try {
      const buckets = await hc.aggregateGroupByPeriod({
        recordType: 'Steps',
        timeRangeFilter: range,
        timeRangeSlicer: { period: 'DAYS', length: 1 },
      });
      for (const b of buckets) {
        const total = b.result.COUNT_TOTAL ?? 0;
        if (total > 0) steps[dateStr(new Date(b.startTime))] = Math.round(total);
      }
    } catch (e) {
      logError(e, { scope: 'healthConnect.sync.steps' });
    }

    // Active calories burned: platform-deduped daily totals.
    try {
      const buckets = await hc.aggregateGroupByPeriod({
        recordType: 'ActiveCaloriesBurned',
        timeRangeFilter: range,
        timeRangeSlicer: { period: 'DAYS', length: 1 },
      });
      for (const b of buckets) {
        const kcal = b.result.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0;
        if (kcal > 0) calories[dateStr(new Date(b.startTime))] = Math.round(kcal);
      }
    } catch (e) {
      logError(e, { scope: 'healthConnect.sync.calories' });
    }

    // Distance: platform-deduped daily totals, km (1 decimal).
    try {
      const buckets = await hc.aggregateGroupByPeriod({
        recordType: 'Distance',
        timeRangeFilter: range,
        timeRangeSlicer: { period: 'DAYS', length: 1 },
      });
      for (const b of buckets) {
        const km = b.result.DISTANCE?.inKilometers ?? 0;
        if (km > 0) distance[dateStr(new Date(b.startTime))] = Math.round(km * 10) / 10;
      }
    } catch (e) {
      logError(e, { scope: 'healthConnect.sync.distance' });
    }

    // Sleep: sessions (stage-aware) keyed to the morning they end.
    try {
      const sleepFrom = new Date(from);
      sleepFrom.setDate(sleepFrom.getDate() - 1);
      const res = await hc.readRecords('SleepSession', {
        timeRangeFilter: { ...range, startTime: sleepFrom.toISOString() },
      });
      Object.assign(sleep, sleepHoursByDate(hcSleepIntervals(res.records)));
    } catch (e) {
      logError(e, { scope: 'healthConnect.sync.sleep' });
    }

    // Weight: latest sample per day → weightLogStore (existing dates win).
    try {
      const res = await hc.readRecords('Weight', {
        timeRangeFilter: range,
        ascendingOrder: true,
      });
      const perDay: Record<string, number> = {};
      for (const r of res.records) {
        const kg = r.weight.inKilograms;
        if (kg > 0) perDay[dateStr(new Date(r.time))] = Math.round(kg * 10) / 10;
      }
      useWeightLogStore.getState().importEntries(
        Object.entries(perDay).map(([date, weight_kg]) => ({ date, weight_kg })),
      );
    } catch (e) {
      logError(e, { scope: 'healthConnect.sync.weight' });
    }

    // Exercise sessions → workout history (idempotent via hc-{recordId} ids),
    // and also summed into exerciseMin per day (HC has no separate "exercise
    // time" aggregate the way Apple's AppleExerciseTime does).
    try {
      const res = await hc.readRecords('ExerciseSession', { timeRangeFilter: range });
      const mapped = await Promise.all(
        res.records
          .filter((r) => r.metadata?.id)
          .map(async (r) => {
            const w = mapHCWorkout({
              id: r.metadata!.id!,
              exerciseType: r.exerciseType,
              startTime: r.startTime,
              endTime: r.endTime,
              title: r.title,
            });
            // HC has no per-session calories field (mapHCWorkout always sets
            // 0) — look up active energy burned within this exact session
            // window so workout history doesn't show 0 kcal while Home's
            // daily "Burned" tile shows a real total for the same activity.
            try {
              const agg = await hc.aggregateRecord({
                recordType: 'ActiveCaloriesBurned',
                timeRangeFilter: { operator: 'between', startTime: r.startTime, endTime: r.endTime },
              });
              const kcal = agg.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0;
              if (kcal > 0) w.calories = Math.round(kcal);
            } catch {
              // Leave calories at 0 — a failed lookup must not drop the session.
            }
            return w;
          }),
      );
      const filtered = mapped.filter((w) => (w.durationMinutes ?? 0) >= 1);
      useWorkoutStore.getState().importWorkouts(filtered);
      for (const w of filtered) {
        exerciseMin[w.date] = (exerciseMin[w.date] ?? 0) + (w.durationMinutes ?? 0);
      }
    } catch (e) {
      logError(e, { scope: 'healthConnect.sync.workouts' });
    }

    useHealthStore.getState().applySync({ steps, sleep, calories, distance, exerciseMin });
  } finally {
    syncInFlight = false;
  }
}

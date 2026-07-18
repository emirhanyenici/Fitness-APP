// ExerciseDB (RapidAPI) key. Like the USDA key, this is EXPO_PUBLIC_* by design
// (bundled into the client): free-tier, read-only exercise lookups only.
// Accepted low risk; hardening path if ever warranted is a Supabase edge proxy.
// Sent as a header (never in the URL), and results are cached on-device
// (services/exerciseDemoCache.ts) so the monthly quota is spent ~once per name.
import { fetchWithTimeout } from './http';
import { logError } from './monitoring';
import { getCachedDemo, setCachedDemo } from './exerciseDemoCache';

// Read lazily (not at module load) so tests can inject a key via process.env.
const getRapidApiKey = () => process.env.EXPO_PUBLIC_RAPIDAPI_KEY ?? '';
const EDB_BASE = 'https://exercisedb.p.rapidapi.com';

/** wger.de — free exercise API, no key required (secondary fallback) */
const WGER_BASE = 'https://wger.de/api/v2';
const WGER_HOST = 'https://wger.de';

export interface ExerciseDemo {
  gifUrl:       string;  // static image (PNG) from wger media
  instructions: string[];
  bodyPart:     string;
  target:       string;
  equipment:    string;
}

// ── wger API response shapes ─────────────────────────────────────────────────

interface WgerSearchSuggestionData {
  base_id: number;
  image?: string | null;
  category?: string;
}

interface WgerSearchSuggestion {
  data: WgerSearchSuggestionData;
}

interface WgerSearchResponse {
  suggestions?: WgerSearchSuggestion[];
}

interface WgerTranslation {
  language: number;
  name?: string;
  description?: string;
}

interface WgerMuscle {
  name_en?: string;
}

interface WgerEquipment {
  name?: string;
}

interface WgerImage {
  image?: string;
}

interface WgerExerciseInfo {
  images?: WgerImage[];
  translations?: WgerTranslation[];
  muscles?: WgerMuscle[];
  equipment?: WgerEquipment[];
}

interface WgerExerciseResult {
  id: number;
  translations?: WgerTranslation[];
  muscles?: WgerMuscle[];
  equipment?: WgerEquipment[];
}

interface WgerListResponse {
  results?: WgerExerciseResult[];
}

// ── Name matching ────────────────────────────────────────────────────────────

/**
 * Normalize a display name for lookup: lowercase, drop parenthesized parts,
 * hyphens → spaces, strip apostrophes, collapse whitespace.
 * "Cat-Cow Stretch" → "cat cow stretch", "Child's Pose" → "childs pose".
 */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/-/g, ' ')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalized display name → ExerciseDB search term.
 * - string:    the term to search (ExerciseDB matches by substring of its names)
 * - 'id:NNNN': pin a specific catalog id (for entries name search can't reach —
 *              the endpoint caps results at 10, alphabetically)
 * - null:      no ExerciseDB entry exists (yoga/stretch flows) → skip the API
 *              entirely and let the modal fall back to the YouTube search link.
 * Names not in this map are searched under their normalized form as-is.
 */
// Terms validated against the live ExerciseDB catalog on 2026-07-18
// (scratchpad probe: every app exercise name was searched; these are the terms
// that returned the right movement).
export const EXERCISE_ALIASES: Record<string, string | null> = {
  // plural → singular / phrasing differences
  'bench press':            'barbell bench press',
  'overhead press':         'barbell seated overhead press',
  'incline dumbbell press': 'dumbbell incline bench press',
  'lateral raises':         'dumbbell lateral raise',
  'front raises':           'barbell front raise',
  'rear delt flyes':        'rear fly',                      // → "dumbbell rear fly"
  'tricep pushdown':        'cable pushdown',
  'dips':                   'chest dip',
  'cable flyes':            'cable middle fly',              // "cable fly" has no match
  'barbell row':            'barbell bent over row',
  'bent over row':          'barbell bent over row',
  'pull ups':               'pull up (neutral grip)',
  'push ups':               'id:0662',                       // plain "push-up", unreachable by search
  'lat pulldown':           'cable pulldown',
  'face pulls':             'cable rear delt row (with rope)', // catalog has no "face pull"
  'seated cable row':       'seated row',                    // → "cable low seated row"
  'squats':                 'squat',
  'deadlift':               'barbell deadlift',
  'walking lunges':         'walking lunge',
  'lunges':                 'lunge',
  'calf raises':            'bodyweight standing calf raise',
  'hip thrusts':            'hip thrust',
  'burpees':                'burpee',
  'mountain climbers':      'mountain climber',
  'high knees':             'high knee',
  'russian twists':         'russian twist',
  'bicycle crunches':       'air bike',                      // catalog name for the movement
  'crunches':               'crunch floor',
  'leg raises':             'leg raise',
  'pec deck':               'lever seated fly',              // pec-deck machine's catalog name
  'shrugs':                 'barbell shrug',
  'preacher curl':          'barbell preacher curl',
  'close grip bench press': 'barbell close-grip bench press',
  'skull crushers':         'lying triceps extension',
  'box jumps':              'box jump',
  // no usable catalog entry — YouTube-only
  'superman hold':       null,  // only "superman push-up" exists, wrong movement
  // yoga / mobility flows — not in ExerciseDB, YouTube-only
  'sun salutation flow': null,
  'downward dog':        null,
  'pigeon pose':         null,
  'cat cow stretch':     null,
  'forward fold':        null,
  'childs pose':         null,
};

/** Alias lookup; null = youtube-only, string = term to search ExerciseDB with. */
export function resolveSearchTerm(name: string): string | null {
  const key = normalizeExerciseName(name);
  if (key in EXERCISE_ALIASES) return EXERCISE_ALIASES[key];
  return key;
}

// ── ExerciseDB (RapidAPI) — primary source, animated GIFs ────────────────────

interface EdbExercise {
  id?: string;
  name?: string;
  bodyPart?: string;
  target?: string;
  equipment?: string;
  instructions?: string[];
}

/**
 * The current ExerciseDB API serves GIFs from a separate authenticated
 * endpoint (no `gifUrl` field on exercises anymore). The URL is stable per
 * exercise id; the Image component must send the RapidAPI headers — use
 * `demoImageSource(gifUrl)` when rendering.
 */
const edbGifUrl = (id: string) => `${EDB_BASE}/image?exerciseId=${encodeURIComponent(id)}&resolution=360`;

/** Build an <Image> source for a demo gifUrl, attaching auth headers when needed. */
export function demoImageSource(gifUrl: string): { uri: string; headers?: Record<string, string> } {
  if (gifUrl.startsWith(EDB_BASE)) {
    return {
      uri: gifUrl,
      headers: {
        'X-RapidAPI-Key':  getRapidApiKey(),
        'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
      },
    };
  }
  return { uri: gifUrl };
}

// Simple per-session rate limiter — prevents runaway API calls (same pattern
// as services/usda.ts, but waits out the cooldown instead of failing).
let _lastDemoFetch = 0;
const DEMO_COOLDOWN_MS = 800;

async function fetchFromExerciseDb(term: string, displayName: string): Promise<ExerciseDemo | null> {
  const isIdLookup = term.startsWith('id:');
  const url = isIdLookup
    ? `${EDB_BASE}/exercises/exercise/${encodeURIComponent(term.slice(3))}`
    : `${EDB_BASE}/exercises/name/${encodeURIComponent(term)}?limit=10`;

  const res = await fetchWithTimeout(url, {
    headers: {
      'X-RapidAPI-Key':  getRapidApiKey(),
      'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
    },
  });
  if (!res.ok) throw new Error(`exercisedb ${res.status}`);
  const json = await res.json();
  const list: EdbExercise[] = isIdLookup ? [json as EdbExercise] : json;
  if (!Array.isArray(list) || list.length === 0) return null;

  // Best hit: exact match on the display name, else on the search term (so an
  // alias pinned to a full catalog name wins over shorter variants), else the
  // shortest name (least-qualified variant, e.g. "barbell squat" over
  // "barbell squat (side pov)").
  const wantedDisplay = normalizeExerciseName(displayName);
  const wantedTerm = normalizeExerciseName(term);
  const best =
    list.find((e) => normalizeExerciseName(e.name ?? '') === wantedDisplay) ??
    list.find((e) => normalizeExerciseName(e.name ?? '') === wantedTerm) ??
    [...list].sort((a, b) => (a.name?.length ?? 999) - (b.name?.length ?? 999))[0];

  if (!best?.id) return null;
  return {
    gifUrl:       edbGifUrl(best.id),
    instructions: (best.instructions ?? []).filter((s) => s.trim().length > 0).slice(0, 6),
    bodyPart:     best.bodyPart  ?? '',
    target:       best.target    ?? '',
    equipment:    best.equipment ?? '',
  };
}

/**
 * Fetch an exercise demo (animated GIF + steps) by display name.
 * Order: on-device cache → ExerciseDB (RapidAPI) → wger (free fallback).
 * Returns null when no demo exists (modal shows placeholder + YouTube link).
 * Errors are logged, never thrown; failures are not cached so the next open
 * retries (e.g. after coming back online).
 */
export async function fetchExerciseDemo(name: string): Promise<ExerciseDemo | null> {
  const cacheKey = normalizeExerciseName(name);

  const cached = await getCachedDemo(cacheKey);
  if (cached !== undefined) return cached.demo;

  const term = resolveSearchTerm(name);
  if (term === null) {
    // Known youtube-only exercise — remember the miss, skip the network.
    await setCachedDemo(cacheKey, null);
    return null;
  }

  // Wait out the cooldown window instead of failing the lookup.
  const sinceLast = Date.now() - _lastDemoFetch;
  if (sinceLast < DEMO_COOLDOWN_MS) {
    await new Promise((r) => setTimeout(r, DEMO_COOLDOWN_MS - sinceLast));
  }
  _lastDemoFetch = Date.now();

  if (getRapidApiKey()) {
    try {
      const demo = await fetchFromExerciseDb(term, name);
      if (demo) {
        await setCachedDemo(cacheKey, demo);
        return demo;
      }
      // Genuine "not in catalog" → try wger before caching a negative.
    } catch (e) {
      logError(e, { scope: 'fetchExerciseDemo', source: 'exercisedb', name });
    }
  } else {
    logError(new Error('EXPO_PUBLIC_RAPIDAPI_KEY missing'), { scope: 'fetchExerciseDemo' });
  }

  // Secondary: wger (static image). Cache only 1 day so a recovered/subscribed
  // ExerciseDB can upgrade the result to an animated GIF soon after.
  const WGER_TTL_MS = 86_400_000;
  try {
    const demo = await fetchExerciseDemoWger(name);
    await setCachedDemo(cacheKey, demo, WGER_TTL_MS);
    return demo;
  } catch (e) {
    logError(e, { scope: 'fetchExerciseDemo', source: 'wger', name });
    return null; // offline/network error — not cached, retried next open
  }
}

// ── wger.de — secondary fallback (static PNG, no key) ────────────────────────

/** Throws on network errors; resolves null when wger has no match. */
async function fetchExerciseDemoWger(name: string): Promise<ExerciseDemo | null> {
  {
    // Step 1: search by name → get base_id + thumbnail
    const searchRes = await fetchWithTimeout(
      `${WGER_BASE}/exercise/search/?term=${encodeURIComponent(name)}&language=english&format=json`
    );
    if (!searchRes.ok) throw new Error(`wger ${searchRes.status}`);
    const searchData: WgerSearchResponse = await searchRes.json();
    const suggestions = searchData.suggestions ?? [];
    if (suggestions.length === 0) return null;

    const first      = suggestions[0].data;
    const baseId: number = first.base_id;
    const imageRel: string | null = first.image ?? null;

    // Step 2: fetch full exercise info for images + description
    const infoRes = await fetchWithTimeout(`${WGER_BASE}/exerciseinfo/${baseId}/?format=json`);
    if (!infoRes.ok) {
      // Partial: use search thumbnail only
      return {
        gifUrl:       imageRel ? `${WGER_HOST}${imageRel}` : '',
        instructions: [],
        bodyPart:     first.category ?? '',
        target:       '',
        equipment:    '',
      };
    }

    const info: WgerExerciseInfo = await infoRes.json();

    // Pick first available image
    const imageUrl: string =
      info.images?.[0]?.image ??
      (imageRel ? `${WGER_HOST}${imageRel}` : '');

    // English description (language id = 2)
    const engTrans = (info.translations ?? []).find((t) => t.language === 2);
    const rawDesc: string = engTrans?.description ?? '';
    // Strip HTML tags and split into sentences for step display
    const cleanDesc = rawDesc.replace(/<[^>]+>/g, '').trim();
    const sentences = cleanDesc
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15)
      .slice(0, 6);

    const muscles   = (info.muscles   ?? []).map((m) => m.name_en ?? '').filter(Boolean);
    const equipment = (info.equipment ?? []).map((e) => e.name    ?? '').filter(Boolean);

    return {
      gifUrl:       imageUrl,
      instructions: sentences,
      bodyPart:     first.category ?? '',
      target:       muscles[0]     ?? '',
      equipment:    equipment.join(', '),
    };
  }
}

/** wger category IDs (language=2 → English) */
const CATEGORY_IDS: Record<string, number> = {
  cardio:    15,
  chest:     11,
  back:      12,
  abs:       10,
  legs:      9,
  arms:      8,
  shoulders: 13,
};

export interface ExerciseDBItem {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
}

export async function fetchByBodyPart(bodyPart: string, limit = 8): Promise<ExerciseDBItem[]> {
  const categoryId = CATEGORY_IDS[bodyPart];
  if (!categoryId) throw new Error(`Unknown bodyPart: ${bodyPart}`);

  const res = await fetchWithTimeout(
    `${WGER_BASE}/exerciseinfo/?format=json&language=2&category=${categoryId}&limit=${limit}&offset=0`
  );
  if (!res.ok) throw new Error(`wger ${res.status}`);
  const data: WgerListResponse = await res.json();

  return (data.results ?? [])
    .map((r) => {
      const name = (r.translations ?? []).find((t) => t.language === 2)?.name ?? '';
      const muscles: string[] = (r.muscles ?? []).map((m) => m.name_en ?? '').filter(Boolean);
      return {
        id:        String(r.id),
        name,
        bodyPart,
        target:    muscles[0] ?? bodyPart,
        equipment: (r.equipment ?? []).map((e) => e.name ?? '').join(', ') || 'none',
      };
    })
    .filter((e) => e.name.trim().length > 0);
}

/** user primary_goal → bodyPart key */
export const GOAL_TO_BODY_PART: Record<string, string> = {
  lose_weight:    'cardio',
  gain_muscle:    'chest',
  improve_energy: 'cardio',
  better_sleep:   'back',
  reduce_stress:  'abs',
  general_health: 'legs',
};

/** log-workout type → bodyPart key */
export const TYPE_TO_BODY_PART: Record<string, string | null> = {
  strength:    'chest',
  cardio:      'cardio',
  hiit:        'cardio',
  flexibility: 'back',
  walk:        'cardio',
  rest:        null,
};

export type EquipmentType = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight';

export type WorkoutExercise = {
  name:      string;
  sets:      number;       // number of sets
  reps:      string;       // "8" | "12" | "45s" | "AMRAP"
  rest:      string;       // "90s" | "60s" | "—"
  muscle:    string;
  equipment: EquipmentType;
};

/** Map wger equipment names → our EquipmentType */
function mapEquipment(raw: string): EquipmentType {
  const s = raw.toLowerCase();
  if (s.includes('barbell'))                              return 'barbell';
  if (s.includes('dumbbell'))                             return 'dumbbell';
  if (s.includes('cable'))                                return 'cable';
  if (s.includes('machine') || s.includes('gym equipm')) return 'machine';
  return 'bodyweight';
}

/** Fallback exercises when API is unavailable */
export const FALLBACK: Record<string, WorkoutExercise[]> = {
  cardio: [
    { name: 'Jump Rope',         sets: 3, reps: '60s', rest: '30s', muscle: 'Full Body',  equipment: 'bodyweight' },
    { name: 'High Knees',        sets: 4, reps: '45s', rest: '20s', muscle: 'Legs',       equipment: 'bodyweight' },
    { name: 'Burpees',           sets: 3, reps: '30s', rest: '45s', muscle: 'Full Body',  equipment: 'bodyweight' },
    { name: 'Mountain Climbers', sets: 3, reps: '45s', rest: '30s', muscle: 'Core',       equipment: 'bodyweight' },
    { name: 'Box Jumps',         sets: 3, reps: '12',  rest: '60s', muscle: 'Legs',       equipment: 'bodyweight' },
  ],
  chest: [
    { name: 'Bench Press',            sets: 4, reps: '8',  rest: '90s', muscle: 'Chest',   equipment: 'barbell'    },
    { name: 'Push Ups',               sets: 3, reps: '12', rest: '60s', muscle: 'Chest',   equipment: 'bodyweight' },
    { name: 'Incline Dumbbell Press', sets: 3, reps: '10', rest: '90s', muscle: 'Chest',   equipment: 'dumbbell'   },
    { name: 'Cable Flyes',            sets: 3, reps: '15', rest: '60s', muscle: 'Chest',   equipment: 'cable'      },
    { name: 'Dips',                   sets: 3, reps: '10', rest: '75s', muscle: 'Triceps', equipment: 'bodyweight' },
  ],
  back: [
    { name: 'Pull Ups',         sets: 4, reps: '8',   rest: '90s', muscle: 'Back',       equipment: 'bodyweight' },
    { name: 'Bent Over Row',    sets: 3, reps: '10',  rest: '90s', muscle: 'Back',       equipment: 'barbell'    },
    { name: 'Lat Pulldown',     sets: 3, reps: '12',  rest: '60s', muscle: 'Lats',       equipment: 'cable'      },
    { name: 'Superman Hold',    sets: 3, reps: '30s', rest: '45s', muscle: 'Lower Back', equipment: 'bodyweight' },
    { name: 'Seated Cable Row', sets: 3, reps: '12',  rest: '60s', muscle: 'Back',       equipment: 'cable'      },
  ],
  abs: [
    { name: 'Plank',            sets: 3, reps: '45s', rest: '45s', muscle: 'Core',      equipment: 'bodyweight' },
    { name: 'Crunches',         sets: 3, reps: '20',  rest: '45s', muscle: 'Abs',       equipment: 'bodyweight' },
    { name: 'Russian Twists',   sets: 3, reps: '15',  rest: '45s', muscle: 'Obliques',  equipment: 'bodyweight' },
    { name: 'Leg Raises',       sets: 3, reps: '12',  rest: '60s', muscle: 'Lower Abs', equipment: 'bodyweight' },
    { name: 'Bicycle Crunches', sets: 3, reps: '20',  rest: '30s', muscle: 'Abs',       equipment: 'bodyweight' },
  ],
  legs: [
    { name: 'Squats',            sets: 4, reps: '10', rest: '90s', muscle: 'Quads',      equipment: 'barbell'  },
    { name: 'Lunges',            sets: 3, reps: '12', rest: '60s', muscle: 'Quads',      equipment: 'bodyweight' },
    { name: 'Romanian Deadlift', sets: 3, reps: '10', rest: '90s', muscle: 'Hamstrings', equipment: 'dumbbell' },
    { name: 'Leg Press',         sets: 3, reps: '12', rest: '90s', muscle: 'Quads',      equipment: 'machine'  },
    { name: 'Calf Raises',       sets: 3, reps: '15', rest: '60s', muscle: 'Calves',     equipment: 'bodyweight' },
  ],
  arms: [
    { name: 'Barbell Curl',       sets: 3, reps: '12', rest: '60s', muscle: 'Biceps',  equipment: 'barbell'  },
    { name: 'Tricep Pushdown',    sets: 3, reps: '12', rest: '60s', muscle: 'Triceps', equipment: 'cable'    },
    { name: 'Hammer Curl',        sets: 3, reps: '10', rest: '60s', muscle: 'Biceps',  equipment: 'dumbbell' },
    { name: 'Skull Crushers',     sets: 3, reps: '10', rest: '75s', muscle: 'Triceps', equipment: 'barbell'  },
    { name: 'Concentration Curl', sets: 3, reps: '12', rest: '60s', muscle: 'Biceps',  equipment: 'dumbbell' },
  ],
  shoulders: [
    { name: 'Overhead Press',  sets: 4, reps: '8',  rest: '90s', muscle: 'Shoulders', equipment: 'barbell'  },
    { name: 'Lateral Raises',  sets: 3, reps: '15', rest: '60s', muscle: 'Deltoids',  equipment: 'dumbbell' },
    { name: 'Front Raises',    sets: 3, reps: '12', rest: '60s', muscle: 'Deltoids',  equipment: 'dumbbell' },
    { name: 'Rear Delt Flyes', sets: 3, reps: '15', rest: '60s', muscle: 'Deltoids',  equipment: 'dumbbell' },
    { name: 'Arnold Press',    sets: 3, reps: '10', rest: '75s', muscle: 'Shoulders', equipment: 'dumbbell' },
  ],
};

/** Convert wger API result to workout exercise format */
export function toWorkoutExercise(ex: ExerciseDBItem, bodyPart: string): WorkoutExercise {
  const isCardio = bodyPart === 'cardio';
  return {
    name:      ex.name.replace(/\b\w/g, (c) => c.toUpperCase()),
    sets:      3,
    reps:      isCardio ? '45s' : '10',
    rest:      isCardio ? '30s' : '60s',
    muscle:    ex.target.replace(/\b\w/g, (c) => c.toUpperCase()),
    equipment: mapEquipment(ex.equipment),
  };
}

export const BODY_PART_LABEL: Record<string, { name: string; duration: string; intensity: string }> = {
  cardio:    { name: 'Cardio Blast',        duration: '30 min', intensity: 'Moderate' },
  chest:     { name: 'Upper Body Strength', duration: '40 min', intensity: 'Moderate' },
  back:      { name: 'Back & Recovery',     duration: '35 min', intensity: 'Light'    },
  abs:       { name: 'Core Training',       duration: '25 min', intensity: 'Moderate' },
  legs:      { name: 'Leg Day',             duration: '45 min', intensity: 'High'     },
  arms:      { name: 'Arms Day',            duration: '35 min', intensity: 'Moderate' },
  shoulders: { name: 'Shoulder Session',    duration: '35 min', intensity: 'Moderate' },
};

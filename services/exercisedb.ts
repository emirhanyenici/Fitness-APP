/** wger.de — free exercise API, no key required */
const WGER_BASE = 'https://wger.de/api/v2';
const WGER_HOST = 'https://wger.de';

export interface ExerciseDemo {
  gifUrl:       string;  // static image (PNG) from wger media
  instructions: string[];
  bodyPart:     string;
  target:       string;
  equipment:    string;
}

/**
 * Fetch exercise image + description from wger (free, no key).
 * Returns null on any error so callers can show a fallback gracefully.
 */
export async function fetchExerciseDemo(name: string): Promise<ExerciseDemo | null> {
  try {
    // Step 1: search by name → get base_id + thumbnail
    const searchRes = await fetch(
      `${WGER_BASE}/exercise/search/?term=${encodeURIComponent(name)}&language=english&format=json`
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();

    const suggestions: any[] = searchData.suggestions ?? [];
    if (suggestions.length === 0) return null;

    const first      = suggestions[0].data;
    const baseId: number = first.base_id;
    const imageRel: string | null = first.image ?? null;

    // Step 2: fetch full exercise info for images + description
    const infoRes = await fetch(`${WGER_BASE}/exerciseinfo/${baseId}/?format=json`);
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

    const info = await infoRes.json();

    // Pick first available image
    const imageUrl: string =
      info.images?.[0]?.image ??
      (imageRel ? `${WGER_HOST}${imageRel}` : '');

    // English description (language id = 2)
    const engTrans = (info.translations ?? []).find((t: any) => t.language === 2);
    const rawDesc: string = engTrans?.description ?? '';
    // Strip HTML tags and split into sentences for step display
    const cleanDesc = rawDesc.replace(/<[^>]+>/g, '').trim();
    const sentences = cleanDesc
      .split(/(?<=[.!?])\s+/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 15)
      .slice(0, 6);

    const muscles   = (info.muscles   ?? []).map((m: any) => m.name_en ?? '').filter(Boolean);
    const equipment = (info.equipment ?? []).map((e: any) => e.name    ?? '').filter(Boolean);

    return {
      gifUrl:       imageUrl,
      instructions: sentences,
      bodyPart:     first.category ?? '',
      target:       muscles[0]     ?? '',
      equipment:    equipment.join(', '),
    };
  } catch {
    return null;
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

  const res = await fetch(
    `${WGER_BASE}/exerciseinfo/?format=json&language=2&category=${categoryId}&limit=${limit}&offset=0`
  );
  if (!res.ok) throw new Error(`wger ${res.status}`);
  const data = await res.json();

  return (data.results ?? [])
    .map((r: any) => {
      const name = (r.translations ?? []).find((t: any) => t.language === 2)?.name ?? '';
      const muscles: string[] = (r.muscles ?? []).map((m: any) => m.name_en ?? '').filter(Boolean);
      return {
        id:        String(r.id),
        name,
        bodyPart,
        target:    muscles[0] ?? bodyPart,
        equipment: (r.equipment ?? []).map((e: any) => e.name).join(', ') || 'none',
      };
    })
    .filter((e: ExerciseDBItem) => e.name.trim().length > 0);
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

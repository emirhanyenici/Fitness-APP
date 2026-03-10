import { WorkoutExercise } from './exercisedb';
import { DailyTargets } from './recommendations';

/**
 * Program types → how the week is split
 */
export type ProgramType = 'full_body' | 'upper_lower' | 'push_pull_legs' | 'bro_split' | 'cardio_core' | 'flexibility';

export interface ProgramInfo {
    id: ProgramType;
    icon: string;
    name: string;
    sub: string;
    minDays: number;
    maxDays: number;
}

/** Available programs — filtered by user's workout days/week */
export const PROGRAMS: ProgramInfo[] = [
    { id: 'full_body',      icon: '🏋️', name: 'Full Body',       sub: 'Train everything each session',                 minDays: 2, maxDays: 4 },
    { id: 'upper_lower',    icon: '💪', name: 'Upper / Lower',   sub: 'Alternate upper and lower body days',           minDays: 3, maxDays: 5 },
    { id: 'push_pull_legs', icon: '🔥', name: 'Push Pull Legs',  sub: 'Chest+Shoulders / Back+Biceps / Legs',          minDays: 3, maxDays: 6 },
    { id: 'bro_split',      icon: '⚡', name: 'Bro Split',       sub: 'One muscle group per day',                      minDays: 4, maxDays: 6 },
    { id: 'cardio_core',    icon: '🏃', name: 'Cardio & Core',   sub: 'HIIT, running, and core work',                  minDays: 2, maxDays: 5 },
    { id: 'flexibility',    icon: '🧘', name: 'Yoga & Mobility', sub: 'Flexibility, recovery, and stretching',         minDays: 1, maxDays: 7 },
];

/** Get programs suitable for the user's workout frequency */
export function getAvailablePrograms(daysPerWeek: number): ProgramInfo[] {
    return PROGRAMS.filter(p => daysPerWeek >= p.minDays && daysPerWeek <= p.maxDays);
}

// ─── Exercise pools per muscle/day type ───────────────────────

const PUSH_EXERCISES: WorkoutExercise[] = [
    { name: 'Bench Press',            sets: 4, reps: '8',  rest: '90s', muscle: 'Chest',         equipment: 'barbell'    },
    { name: 'Overhead Press',         sets: 4, reps: '8',  rest: '90s', muscle: 'Shoulders',     equipment: 'barbell'    },
    { name: 'Incline Dumbbell Press', sets: 3, reps: '10', rest: '75s', muscle: 'Upper Chest',   equipment: 'dumbbell'   },
    { name: 'Lateral Raises',         sets: 3, reps: '15', rest: '60s', muscle: 'Deltoids',      equipment: 'dumbbell'   },
    { name: 'Tricep Pushdown',        sets: 3, reps: '12', rest: '60s', muscle: 'Triceps',       equipment: 'cable'      },
    { name: 'Dips',                   sets: 3, reps: '10', rest: '75s', muscle: 'Chest/Triceps', equipment: 'bodyweight' },
    { name: 'Cable Flyes',            sets: 3, reps: '12', rest: '60s', muscle: 'Chest',         equipment: 'cable'      },
];

const PULL_EXERCISES: WorkoutExercise[] = [
    { name: 'Barbell Row',       sets: 4, reps: '8',  rest: '90s', muscle: 'Back',       equipment: 'barbell'    },
    { name: 'Pull Ups',          sets: 4, reps: '8',  rest: '90s', muscle: 'Lats',       equipment: 'bodyweight' },
    { name: 'Lat Pulldown',      sets: 3, reps: '12', rest: '60s', muscle: 'Lats',       equipment: 'cable'      },
    { name: 'Face Pulls',        sets: 3, reps: '15', rest: '60s', muscle: 'Rear Delts', equipment: 'cable'      },
    { name: 'Barbell Curl',      sets: 3, reps: '12', rest: '60s', muscle: 'Biceps',     equipment: 'barbell'    },
    { name: 'Hammer Curl',       sets: 3, reps: '10', rest: '60s', muscle: 'Biceps',     equipment: 'dumbbell'   },
    { name: 'Seated Cable Row',  sets: 3, reps: '12', rest: '60s', muscle: 'Back',       equipment: 'cable'      },
];

const LEG_EXERCISES: WorkoutExercise[] = [
    { name: 'Squats',             sets: 4, reps: '8',  rest: '120s', muscle: 'Quads',      equipment: 'barbell'    },
    { name: 'Romanian Deadlift',  sets: 3, reps: '10', rest: '90s',  muscle: 'Hamstrings', equipment: 'barbell'    },
    { name: 'Leg Press',          sets: 3, reps: '12', rest: '90s',  muscle: 'Quads',      equipment: 'machine'    },
    { name: 'Walking Lunges',     sets: 3, reps: '12', rest: '60s',  muscle: 'Glutes',     equipment: 'bodyweight' },
    { name: 'Leg Curl',           sets: 3, reps: '12', rest: '60s',  muscle: 'Hamstrings', equipment: 'machine'    },
    { name: 'Calf Raises',        sets: 4, reps: '15', rest: '45s',  muscle: 'Calves',     equipment: 'bodyweight' },
    { name: 'Hip Thrusts',        sets: 3, reps: '10', rest: '75s',  muscle: 'Glutes',     equipment: 'barbell'    },
];

const UPPER_EXERCISES: WorkoutExercise[] = [
    { name: 'Bench Press',     sets: 4, reps: '8',  rest: '90s', muscle: 'Chest',     equipment: 'barbell'    },
    { name: 'Barbell Row',     sets: 4, reps: '8',  rest: '90s', muscle: 'Back',      equipment: 'barbell'    },
    { name: 'Overhead Press',  sets: 3, reps: '10', rest: '90s', muscle: 'Shoulders', equipment: 'barbell'    },
    { name: 'Pull Ups',        sets: 3, reps: '8',  rest: '75s', muscle: 'Lats',      equipment: 'bodyweight' },
    { name: 'Lateral Raises',  sets: 3, reps: '15', rest: '60s', muscle: 'Deltoids',  equipment: 'dumbbell'   },
    { name: 'Barbell Curl',    sets: 3, reps: '12', rest: '60s', muscle: 'Biceps',    equipment: 'barbell'    },
    { name: 'Tricep Pushdown', sets: 3, reps: '12', rest: '60s', muscle: 'Triceps',   equipment: 'cable'      },
];

const LOWER_EXERCISES: WorkoutExercise[] = [
    { name: 'Squats',            sets: 4, reps: '8',  rest: '120s', muscle: 'Quads',      equipment: 'barbell'    },
    { name: 'Romanian Deadlift', sets: 4, reps: '8',  rest: '90s',  muscle: 'Hamstrings', equipment: 'barbell'    },
    { name: 'Leg Press',         sets: 3, reps: '12', rest: '90s',  muscle: 'Quads',      equipment: 'machine'    },
    { name: 'Walking Lunges',    sets: 3, reps: '12', rest: '60s',  muscle: 'Glutes',     equipment: 'bodyweight' },
    { name: 'Leg Curl',          sets: 3, reps: '12', rest: '60s',  muscle: 'Hamstrings', equipment: 'machine'    },
    { name: 'Calf Raises',       sets: 4, reps: '15', rest: '45s',  muscle: 'Calves',     equipment: 'bodyweight' },
];

const FULL_BODY_EXERCISES: WorkoutExercise[] = [
    { name: 'Squats',            sets: 3, reps: '10', rest: '90s', muscle: 'Quads',      equipment: 'barbell'    },
    { name: 'Bench Press',       sets: 3, reps: '10', rest: '90s', muscle: 'Chest',      equipment: 'barbell'    },
    { name: 'Barbell Row',       sets: 3, reps: '10', rest: '90s', muscle: 'Back',       equipment: 'barbell'    },
    { name: 'Overhead Press',    sets: 3, reps: '8',  rest: '75s', muscle: 'Shoulders',  equipment: 'barbell'    },
    { name: 'Romanian Deadlift', sets: 3, reps: '10', rest: '90s', muscle: 'Hamstrings', equipment: 'barbell'    },
    { name: 'Pull Ups',          sets: 3, reps: '8',  rest: '75s', muscle: 'Lats',       equipment: 'bodyweight' },
    { name: 'Plank',             sets: 3, reps: '45s',rest: '30s', muscle: 'Core',       equipment: 'bodyweight' },
];

const CARDIO_CORE_EXERCISES: WorkoutExercise[] = [
    { name: 'Jump Rope',         sets: 3, reps: '60s', rest: '30s', muscle: 'Full Body', equipment: 'bodyweight' },
    { name: 'Burpees',           sets: 3, reps: '15',  rest: '45s', muscle: 'Full Body', equipment: 'bodyweight' },
    { name: 'Mountain Climbers', sets: 3, reps: '45s', rest: '30s', muscle: 'Core',      equipment: 'bodyweight' },
    { name: 'High Knees',        sets: 3, reps: '45s', rest: '20s', muscle: 'Legs',      equipment: 'bodyweight' },
    { name: 'Plank',             sets: 3, reps: '60s', rest: '30s', muscle: 'Core',      equipment: 'bodyweight' },
    { name: 'Russian Twists',    sets: 3, reps: '20',  rest: '30s', muscle: 'Obliques',  equipment: 'bodyweight' },
    { name: 'Bicycle Crunches',  sets: 3, reps: '20',  rest: '30s', muscle: 'Abs',       equipment: 'bodyweight' },
];

const FLEX_EXERCISES: WorkoutExercise[] = [
    { name: 'Sun Salutation Flow', sets: 3, reps: '5',   rest: '—',  muscle: 'Full Body',  equipment: 'bodyweight' },
    { name: 'Downward Dog',        sets: 3, reps: '30s', rest: '15s', muscle: 'Hamstrings', equipment: 'bodyweight' },
    { name: 'Pigeon Pose',         sets: 2, reps: '45s', rest: '15s', muscle: 'Hips',       equipment: 'bodyweight' },
    { name: 'Cat-Cow Stretch',     sets: 3, reps: '10',  rest: '—',  muscle: 'Spine',      equipment: 'bodyweight' },
    { name: 'Forward Fold',        sets: 2, reps: '30s', rest: '15s', muscle: 'Hamstrings', equipment: 'bodyweight' },
    { name: "Child's Pose",        sets: 2, reps: '45s', rest: '—',  muscle: 'Back',       equipment: 'bodyweight' },
];

// Bro split single-muscle sessions
const CHEST_SESSION: WorkoutExercise[] = [
    { name: 'Bench Press',            sets: 4, reps: '8',  rest: '90s', muscle: 'Chest',       equipment: 'barbell'    },
    { name: 'Incline Dumbbell Press', sets: 3, reps: '10', rest: '75s', muscle: 'Upper Chest', equipment: 'dumbbell'   },
    { name: 'Cable Flyes',            sets: 3, reps: '12', rest: '60s', muscle: 'Chest',       equipment: 'cable'      },
    { name: 'Dips',                   sets: 3, reps: '10', rest: '75s', muscle: 'Lower Chest', equipment: 'bodyweight' },
    { name: 'Push Ups',               sets: 3, reps: '15', rest: '60s', muscle: 'Chest',       equipment: 'bodyweight' },
    { name: 'Pec Deck',               sets: 3, reps: '12', rest: '60s', muscle: 'Chest',       equipment: 'machine'    },
];

const BACK_SESSION: WorkoutExercise[] = [
    { name: 'Deadlift',         sets: 4, reps: '5',  rest: '120s', muscle: 'Back',      equipment: 'barbell'    },
    { name: 'Pull Ups',         sets: 4, reps: '8',  rest: '90s',  muscle: 'Lats',      equipment: 'bodyweight' },
    { name: 'Barbell Row',      sets: 3, reps: '10', rest: '90s',  muscle: 'Back',      equipment: 'barbell'    },
    { name: 'Lat Pulldown',     sets: 3, reps: '12', rest: '60s',  muscle: 'Lats',      equipment: 'cable'      },
    { name: 'Seated Cable Row', sets: 3, reps: '12', rest: '60s',  muscle: 'Mid Back',  equipment: 'cable'      },
    { name: 'Face Pulls',       sets: 3, reps: '15', rest: '45s',  muscle: 'Rear Delts',equipment: 'cable'      },
];

const SHOULDER_SESSION: WorkoutExercise[] = [
    { name: 'Overhead Press',  sets: 4, reps: '8',  rest: '90s', muscle: 'Shoulders',  equipment: 'barbell'  },
    { name: 'Arnold Press',    sets: 3, reps: '10', rest: '75s', muscle: 'Shoulders',  equipment: 'dumbbell' },
    { name: 'Lateral Raises',  sets: 4, reps: '15', rest: '60s', muscle: 'Deltoids',   equipment: 'dumbbell' },
    { name: 'Front Raises',    sets: 3, reps: '12', rest: '60s', muscle: 'Front Delts',equipment: 'dumbbell' },
    { name: 'Rear Delt Flyes', sets: 3, reps: '15', rest: '60s', muscle: 'Rear Delts', equipment: 'dumbbell' },
    { name: 'Shrugs',          sets: 3, reps: '15', rest: '60s', muscle: 'Traps',      equipment: 'dumbbell' },
];

const ARM_SESSION: WorkoutExercise[] = [
    { name: 'Barbell Curl',          sets: 4, reps: '10', rest: '60s', muscle: 'Biceps',  equipment: 'barbell'  },
    { name: 'Close-Grip Bench Press',sets: 4, reps: '8',  rest: '75s', muscle: 'Triceps', equipment: 'barbell'  },
    { name: 'Hammer Curl',           sets: 3, reps: '12', rest: '60s', muscle: 'Biceps',  equipment: 'dumbbell' },
    { name: 'Skull Crushers',        sets: 3, reps: '10', rest: '60s', muscle: 'Triceps', equipment: 'barbell'  },
    { name: 'Preacher Curl',         sets: 3, reps: '10', rest: '60s', muscle: 'Biceps',  equipment: 'barbell'  },
    { name: 'Tricep Pushdown',       sets: 3, reps: '12', rest: '45s', muscle: 'Triceps', equipment: 'cable'    },
];

// ─── Day rotation per program type ───────────────────────────

export interface DayPlan {
    dayLabel:    string;
    muscleGroup: string;
    exercises:   WorkoutExercise[];
    intensity:   string;
    duration:    string;
}

/** Bro split rotation */
const BRO_ROTATION: DayPlan[] = [
    { dayLabel: 'Day 1', muscleGroup: 'Chest',     exercises: CHEST_SESSION,    intensity: 'High',     duration: '50 min' },
    { dayLabel: 'Day 2', muscleGroup: 'Back',      exercises: BACK_SESSION,     intensity: 'High',     duration: '55 min' },
    { dayLabel: 'Day 3', muscleGroup: 'Shoulders', exercises: SHOULDER_SESSION, intensity: 'Moderate', duration: '45 min' },
    { dayLabel: 'Day 4', muscleGroup: 'Legs',      exercises: LEG_EXERCISES,    intensity: 'High',     duration: '55 min' },
    { dayLabel: 'Day 5', muscleGroup: 'Arms',      exercises: ARM_SESSION,      intensity: 'Moderate', duration: '40 min' },
];

const PPL_ROTATION: DayPlan[] = [
    { dayLabel: 'Push', muscleGroup: 'Push (Chest, Shoulders, Triceps)', exercises: PUSH_EXERCISES, intensity: 'High', duration: '50 min' },
    { dayLabel: 'Pull', muscleGroup: 'Pull (Back, Biceps)',               exercises: PULL_EXERCISES, intensity: 'High', duration: '50 min' },
    { dayLabel: 'Legs', muscleGroup: 'Legs & Glutes',                     exercises: LEG_EXERCISES,  intensity: 'High', duration: '55 min' },
];

const UL_ROTATION: DayPlan[] = [
    { dayLabel: 'Upper', muscleGroup: 'Upper Body', exercises: UPPER_EXERCISES, intensity: 'Moderate', duration: '50 min' },
    { dayLabel: 'Lower', muscleGroup: 'Lower Body', exercises: LOWER_EXERCISES, intensity: 'High',     duration: '50 min' },
];

/** Equipment allowed in home workouts */
const HOME_EQUIPMENT: WorkoutExercise['equipment'][] = ['bodyweight', 'dumbbell'];

/**
 * Get today's workout plan based on program type, day of week, and exercise count.
 * Pass environment='home' to automatically filter out gym-only equipment.
 */
export function getTodayPlan(
    program: ProgramType,
    dayOfWeek: number,
    exerciseCount = 6,
    environment: 'gym' | 'home' = 'gym',
): DayPlan {
    let rotation: DayPlan[];

    switch (program) {
        case 'full_body':
            rotation = [{ dayLabel: 'Full Body',   muscleGroup: 'Full Body',          exercises: FULL_BODY_EXERCISES,   intensity: 'Moderate', duration: '50 min' }];
            break;
        case 'push_pull_legs':
            rotation = PPL_ROTATION;
            break;
        case 'upper_lower':
            rotation = UL_ROTATION;
            break;
        case 'bro_split':
            rotation = BRO_ROTATION;
            break;
        case 'cardio_core':
            rotation = [{ dayLabel: 'Cardio & Core', muscleGroup: 'Cardio & Core',    exercises: CARDIO_CORE_EXERCISES, intensity: 'High',     duration: '35 min' }];
            break;
        case 'flexibility':
            rotation = [{ dayLabel: 'Mobility',      muscleGroup: 'Yoga & Mobility',  exercises: FLEX_EXERCISES,        intensity: 'Light',    duration: '40 min' }];
            break;
        default:
            rotation = [{ dayLabel: 'Full Body',   muscleGroup: 'Full Body',          exercises: FULL_BODY_EXERCISES,   intensity: 'Moderate', duration: '50 min' }];
    }

    // Pick today's slot in the rotation
    const idx  = dayOfWeek % rotation.length;
    const plan = rotation[idx];

    // Filter to home-compatible equipment when applicable
    const pool = environment === 'home'
        ? plan.exercises.filter(e => HOME_EQUIPMENT.includes(e.equipment))
        : plan.exercises;

    return {
        ...plan,
        exercises: pool.slice(0, exerciseCount),
    };
}

/**
 * Recommend the best program type based on user's goal and days/week.
 */
export function recommendProgram(goal: string, daysPerWeek: number): ProgramType {
    if (daysPerWeek <= 2) {
        return goal === 'reduce_stress' || goal === 'better_sleep' ? 'flexibility' : 'full_body';
    }
    if (daysPerWeek === 3) {
        if (goal === 'gain_muscle') return 'push_pull_legs';
        if (goal === 'lose_weight' || goal === 'improve_energy') return 'full_body';
        return 'upper_lower';
    }
    if (daysPerWeek === 4) {
        if (goal === 'gain_muscle') return 'upper_lower';
        if (goal === 'lose_weight') return 'push_pull_legs';
        return 'upper_lower';
    }
    // 5+
    if (goal === 'gain_muscle') return 'bro_split';
    return 'push_pull_legs';
}

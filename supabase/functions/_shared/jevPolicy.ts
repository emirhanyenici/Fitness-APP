/**
 * Jev (TypeSafe System One) decision policy — PURE logic, no Deno / network.
 *
 * Jev returns calibrated probabilities, not text. Everything here turns those
 * probabilities into a small set of explicit actions. Thresholds live in one
 * place so they can be tuned (and unit-tested) without touching the handlers.
 * Fail-open by design: a missing/failed Jev call (`probs === null`) always
 * resolves to "allow" so Jev can never take the AI features down.
 */

export type NoulQuestion = {
  type: 'noul';
  instructions: string;
  criteria?: { true: string; false: string };
};

export type Probs = Record<string, number> | null;

export const THRESHOLDS = {
  /** Eating-disorder / dangerous-restriction signals — hard stop. */
  eatingDisorder: 0.7,
  /** User states a daily calorie goal far below safe levels. */
  veryLowCalorie: 0.7,
  /** Clearly unrelated to health/fitness — hard stop (also blocks free-LLM abuse). */
  offTopic: 0.9,
  /** Medical question — steer the model + add a see-a-professional note. */
  medical: 0.7,
  /** Coach reply that recommends dangerous dieting — replaced entirely. */
  dangerousDietReply: 0.7,
  /** Coach reply that diagnoses / prescribes — footer appended. */
  medicalReply: 0.7,
  /** Photo result looks like not-food. */
  notFood: 0.25,
  /** Photo calories implausible for the listed items. */
  implausibleNutrition: 0.3,
} as const;

// ── Messages shown to the user (fixed text — never model-generated) ──────────

export const EATING_DISORDER_MESSAGE =
  "I'm not able to help with extreme dieting, fasting, or purging, because it can seriously harm your health. " +
  "If food or your body is weighing on you, please talk to a doctor, a registered dietitian, or a mental-health professional. " +
  "If you're in crisis or feel unsafe, contact your local emergency number or a crisis line right away. " +
  "I'm happy to help with balanced, sustainable nutrition and training whenever you're ready.";

export const OFF_TOPIC_MESSAGE =
  "I'm Zenova's health & fitness coach, so I can only help with workouts, nutrition, sleep, recovery and your Zenova progress. " +
  'Ask me something in those areas and I will jump in!';

export const MEDICAL_STEER_NOTE =
  '\n\nSAFETY: The user is asking something medical (symptoms, injury, medication, a condition, or pregnancy). ' +
  'Do NOT diagnose or recommend treatment or doses. Give only general, widely accepted wellness information and ' +
  'clearly tell them to consult a doctor or qualified healthcare professional.';

export const SAFETY_FOOTER =
  '\n\nThis is general wellness information, not medical advice. Please check with a doctor or qualified professional before acting on it.';

// ── ai-coach: triage of the latest user message ──────────────────────────────

export interface ChatMsg { role: string; content: string }

export function triageRequest(messages: ChatMsg[]) {
  const recent = messages.slice(-4).map((m) => ({ role: m.role, text: m.content.slice(0, 600) }));
  const latest = [...messages].reverse().find((m) => m.role === 'user');
  return {
    state: {
      app: 'Zenova: a health, fitness, nutrition, sleep and recovery coaching app',
      recent_conversation: recent,
      latest_user_message: (latest?.content ?? '').slice(0, 1000),
    },
    questions: {
      eatingDisorder: {
        type: 'noul',
        instructions:
          'The latest user message asks for, or shows signs of, extreme or dangerous weight control: starvation or very-low-calorie targets, purging, laxative/diuretic misuse, fasting for many days, or self-punishment about eating or body weight.',
        criteria: {
          true: 'Seeks or describes starving, purging, extreme restriction, or harming oneself over food/weight',
          false: 'Normal diet, weight-loss, bulking or nutrition question within safe, ordinary ranges',
        },
      },
      veryLowCalorie: {
        type: 'noul',
        instructions:
          'The latest user message states that the user wants to eat, consume or aim for a very low daily calorie amount, below about 1000 kcal per day (for example "400 calories a day", "günde 400 kalori", "500 kcal daily"), or asks for such a plan.',
        criteria: {
          true: 'Sets or asks for a daily intake goal under about 1000 kcal',
          false: 'Does not state a daily intake goal that low (a single meal or food item with few calories does not count)',
        },
      },
      medical: {
        type: 'noul',
        instructions:
          'The latest user message asks about a medical issue: diagnosing symptoms, treating an injury or illness, medication or supplement dosing, a chronic condition, or pregnancy.',
        criteria: {
          true: 'Needs medical judgment (symptoms, diagnosis, treatment, medication, condition, pregnancy)',
          false: 'General fitness, food or lifestyle question that needs no medical judgment',
        },
      },
      offTopic: {
        type: 'noul',
        instructions:
          'The latest user message is clearly unrelated to health, fitness, exercise, nutrition, sleep, recovery, mood, habits or the Zenova app (for example coding, homework, politics, general trivia). Greetings, thanks and short follow-ups to the ongoing conversation are NOT off-topic.',
        criteria: {
          true: 'Clearly outside health, fitness, nutrition, sleep, recovery, wellbeing or the app',
          false: 'About those topics, or a greeting / thanks / follow-up to the conversation',
        },
      },
    },
  };
}

export type TriageAction = 'block_eating_disorder' | 'block_off_topic' | 'steer_medical' | 'allow';

export function decideTriage(p: Probs): TriageAction {
  if (!p) return 'allow';
  if ((p.eatingDisorder ?? 0) >= THRESHOLDS.eatingDisorder) return 'block_eating_disorder';
  if ((p.veryLowCalorie ?? 0) >= THRESHOLDS.veryLowCalorie) return 'block_eating_disorder';
  if ((p.offTopic ?? 0) >= THRESHOLDS.offTopic) return 'block_off_topic';
  if ((p.medical ?? 0) >= THRESHOLDS.medical) return 'steer_medical';
  return 'allow';
}

// ── ai-coach: check the model's own reply before it reaches the user ─────────

export function replyCheckRequest(reply: string) {
  return {
    state: { coach_reply: reply.slice(0, 3000) },
    questions: {
      dangerousDiet: {
        type: 'noul',
        instructions:
          'The coach reply recommends or accepts dangerous dieting: a daily intake under about 1200 kcal, multi-day fasting, purging, or other extreme restriction.',
        criteria: {
          true: 'Recommends or plans a daily intake under about 1200 kcal, long fasting, or purging',
          false: 'Nutrition and training guidance within safe, ordinary ranges',
        },
      },
      medicalAdvice: {
        type: 'noul',
        instructions:
          'The coach reply gives a medical diagnosis or prescribes treatment or medication doses.',
        criteria: {
          true: 'Contains a diagnosis, treatment plan or dosing advice',
          false: 'General wellness, training or nutrition guidance',
        },
      },
    },
  };
}

export type ReplyAction = 'replace_with_safety' | 'append_footer' | 'allow';

export function decideReply(p: Probs): ReplyAction {
  if (!p) return 'allow';
  if ((p.dangerousDiet ?? 0) >= THRESHOLDS.dangerousDietReply) return 'replace_with_safety';
  if ((p.medicalAdvice ?? 0) >= THRESHOLDS.medicalReply) return 'append_footer';
  return 'allow';
}

// ── analyze-photo: sanity-check the vision result (text only) ────────────────

export interface PhotoItem { name: string; grams: number; calories: number }

export function photoCheckRequest(name: string, items: PhotoItem[], totalCalories: number) {
  return {
    state: {
      dish: name,
      items: items.slice(0, 10).map((i) => ({ name: i.name, grams: i.grams, calories: i.calories })),
      total_calories: totalCalories,
    },
    questions: {
      isFood: {
        type: 'noul',
        instructions: 'Every listed item is real food or drink that a person eats or drinks (not a plate, table, utensil, packaging or other object).',
      },
      plausible: {
        type: 'noul',
        instructions:
          'The calories are plausible for these items at these gram weights (roughly within normal nutrition values for the food as prepared).',
      },
    },
  };
}

export function decidePhoto(p: Probs): 'doubtful' | 'ok' {
  if (!p) return 'ok';
  if ((p.isFood ?? 1) < THRESHOLDS.notFood) return 'doubtful';
  if ((p.plausible ?? 1) < THRESHOLDS.implausibleNutrition) return 'doubtful';
  return 'ok';
}

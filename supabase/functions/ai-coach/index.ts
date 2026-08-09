import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Restrict CORS to known origins.
// Set ALLOWED_ORIGINS in Supabase dashboard → Edge Functions → Secrets
// as a comma-separated list, e.g. "https://yourapp.com,exp://localhost:8082"
const RAW_ORIGINS = Deno.env.get('ALLOWED_ORIGINS') ?? '';
const ALLOWED_ORIGINS: string[] = RAW_ORIGINS
  ? RAW_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

function corsHeaders(origin: string | null): Record<string, string> {
  // CORS is browser-only; native mobile apps send no Origin header (unaffected).
  // Fail CLOSED: only reflect an explicitly allow-listed origin. An unknown
  // origin — or a missing/empty ALLOWED_ORIGINS config — gets no
  // Access-Control-Allow-Origin, so the browser blocks the response. Never
  // reflect an arbitrary caller's Origin.
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

// xAI (Grok) — OpenAI-compatible chat completions API. Key lives only in
// Supabase secrets (supabase secrets set XAI_API_KEY=...), never in the client.
const XAI_KEY       = Deno.env.get('XAI_API_KEY') ?? '';
const XAI_MODEL     = Deno.env.get('XAI_MODEL') ?? 'grok-4.20-non-reasoning';
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

// Nutrition lookup fallback chain for the food_nutrition_lookup tool — all
// server-side secrets, never exposed to the client. Edamam is accessed via
// RapidAPI (same account/key the app already uses for ExerciseDB) rather
// than Edamam's own app_id/app_key, so auth is a single RapidAPI key + host
// header pair. RAPIDAPI_EDAMAM_HOST defaults to the conventional RapidAPI
// proxy hostname for this API — verify against the "Code Snippets" tab on
// your RapidAPI subscription and override the secret if it differs.
const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY') ?? '';
const RAPIDAPI_EDAMAM_HOST = Deno.env.get('RAPIDAPI_EDAMAM_HOST') ?? 'edamam-edamam-nutrition-analysis.p.rapidapi.com';
const USDA_API_KEY = Deno.env.get('USDA_API_KEY') ?? '';

const SYSTEM_PROMPT = `You are Zenova AI, a personal health and fitness coach inside the Zenova LifeScore app.
You help users with personalized workout plans, nutrition advice, recovery optimization, and motivation.
Keep responses concise (2-4 sentences max unless generating a plan), friendly, and actionable.
For workout plans, format as a numbered list with sets/reps.
For nutrition, give specific food suggestions with portion sizes.
When the user asks about calories or nutrition facts for a specific food or meal, always call
food_nutrition_lookup instead of guessing — then base your answer on its result.
Never give medical diagnoses or replace professional medical advice.`;

const FOOD_LOOKUP_TOOL = {
  type: 'function',
  function: {
    name: 'food_nutrition_lookup',
    description: 'Look up accurate calorie and macro (protein/carbs/fat) data for a specific food or meal. Use this whenever the user asks about calories or nutrition facts, instead of guessing from memory.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The food or meal to look up, in natural language, optionally with quantity, e.g. "1 chicken quesadilla" or "2 boiled eggs and a slice of toast".',
        },
      },
      required: ['query'],
    },
  },
};

/** Fetch with an abort-based timeout — no shared utils between edge fns, mirrors services/http.ts. */
async function fetchWithTimeout(input: string, init: RequestInit = {}, ms = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolves a natural-language food query to a compact nutrition summary for
 * the model to base its answer on. Tries Edamam (parses quantity/serving from
 * the query directly, e.g. "1 chicken quesadilla") first, then USDA FDC, then
 * Open Food Facts — each a best-effort, independently-caught step so one
 * provider's outage doesn't block the others. The raw nutrient data is never
 * stored — only a one-off natural-language summary is produced for the
 * model's reply, in line with Edamam's no-caching terms.
 */
async function lookupNutrition(query: string): Promise<string> {
  if (RAPIDAPI_KEY) {
    try {
      const res = await fetchWithTimeout(
        `https://${RAPIDAPI_EDAMAM_HOST}/api/nutrition-data?nutrition-type=cooking&ingr=${encodeURIComponent(query)}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': RAPIDAPI_EDAMAM_HOST,
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        const n = data?.totalNutrients;
        if (typeof data?.calories === 'number' && data.calories > 0) {
          const protein = Math.round(n?.PROCNT?.quantity ?? 0);
          const carbs   = Math.round(n?.CHOCDF?.quantity ?? 0);
          const fat     = Math.round(n?.FAT?.quantity ?? 0);
          return `${query}: ${Math.round(data.calories)} kcal, ${protein}g protein, ${carbs}g carbs, ${fat}g fat` +
            (data.totalWeight ? ` (~${Math.round(data.totalWeight)}g total)` : '');
        }
      }
    } catch (err) {
      console.error('edamam (rapidapi) lookup failed:', err);
    }
  }

  if (USDA_API_KEY) {
    try {
      const res = await fetchWithTimeout(
        `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=${USDA_API_KEY}&dataType=SR%20Legacy,Branded&pageSize=1`,
      );
      if (res.ok) {
        const data = await res.json();
        const food = data?.foods?.[0];
        if (food) {
          const getNutrient = (id: number) =>
            Math.round(food.foodNutrients?.find((n: Record<string, unknown>) => n.nutrientId === id)?.value ?? 0);
          return `${food.description}: ${getNutrient(1008)} kcal, ${getNutrient(1003)}g protein, ` +
            `${getNutrient(1005)}g carbs, ${getNutrient(1004)}g fat (per USDA reported serving)`;
        }
      }
    } catch (err) {
      console.error('usda lookup failed:', err);
    }
  }

  try {
    const res = await fetchWithTimeout(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=1&fields=product_name,nutriments`,
    );
    if (res.ok) {
      const data = await res.json();
      const product = data?.products?.[0];
      const n = product?.nutriments;
      const kcal = n?.['energy-kcal_100g'] ?? n?.['energy-kcal'];
      if (product?.product_name && kcal != null) {
        return `${product.product_name} (per 100g): ${Math.round(kcal)} kcal, ${Math.round(n?.proteins_100g ?? 0)}g protein, ` +
          `${Math.round(n?.carbohydrates_100g ?? 0)}g carbs, ${Math.round(n?.fat_100g ?? 0)}g fat`;
      }
    }
  } catch (err) {
    console.error('open food facts lookup failed:', err);
  }

  return 'No nutrition data found for this query.';
}

/** Forward only whitelisted, non-PII profile fields to the AI context. */
function sanitizeProfile(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '';
  const p = raw as Record<string, unknown>;
  const SAFE_KEYS = ['primary_goal', 'workout_frequency', 'diet_type', 'fitness_level', 'activity_level', 'gender', 'workout_environment'];
  const parts: string[] = [];
  for (const key of SAFE_KEYS) {
    if (typeof p[key] === 'string') parts.push(`${key}=${String(p[key]).slice(0, 80)}`);
  }
  return parts.length ? ` User profile: ${parts.join(', ')}.` : '';
}

/**
 * Build a recovery trend summary from the last 7 entries.
 * Averages mood, energy, and stress on a 1–5 scale.
 * Returns an empty string when data is absent.
 */
function buildRecoveryContext(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return '';
  const recent = (raw as Record<string, unknown>[]).slice(-7);
  const avg = (key: string) => {
    const sum = recent.reduce((s, e) => s + (Number(e[key]) || 0), 0);
    return (sum / recent.length).toFixed(1);
  };
  return ` Recovery trend (7d avg): mood=${avg('mood')}/5, energy=${avg('energy')}/5, stress=${avg('stress')}/5.`;
}

/** Validate message array: only known roles, content capped at 2 000 chars. */
function sanitizeMessages(raw: unknown): Array<{ role: string; content: string }> | null {
  if (!Array.isArray(raw)) return null;
  const ALLOWED_ROLES = new Set(['user', 'assistant']);
  const result: Array<{ role: string; content: string }> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { role, content } = item as Record<string, unknown>;
    if (typeof role !== 'string' || !ALLOWED_ROLES.has(role)) continue;
    if (typeof content !== 'string') continue;
    result.push({ role, content: content.slice(0, 2000) });
  }
  return result.slice(-10); // cap conversation history
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  // Fail closed: reject browser requests from a non-allow-listed origin.
  // Native apps send no Origin header, so they are unaffected.
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: 'Forbidden origin' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }

  // Verify the caller holds a valid Supabase session JWT.
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  // Per-user daily rate limit — protects against unbounded AI-provider spend
  // from a leaked JWT or abusive client. Tier-aware: the plan is mirrored into
  // public.subscriptions by the revenuecat-webhook fn; missing row = free.
  // Free matches the client's 5/day gate (UTC-day vs local-day may drift near
  // midnight). Counts in the 'chat' bucket (weekly report shares it); photo
  // analysis has its own bucket in analyze-photo.
  //
  // Pro limit sized from REAL measured xAI cost (2026-07-28, from function
  // logs' cost_in_usd_ticks — see [[pro-tiering]] memory): a chat turn that
  // triggers the nutrition-lookup tool (2 xAI round-trips) costs up to
  // ~$0.0025 worst case. At the old 100/day ceiling, a user maxing out every
  // day with every message hitting the tool costs up to $7.50/mo in chat
  // alone (+ up to $0.84/mo for 10 photo scans/day) — that can exceed the
  // $7.99/mo subscription's net-of-Apple-cut revenue (~$5.59-6.79). 50/day
  // caps worst-case chat spend at ~$3.75/mo, keeping total AI cost safely
  // under net revenue even under adversarial/bot usage.
  // FORCE_PRO: TestFlight-only override mirroring the client's
  // EXPO_PUBLIC_FORCE_PRO (services/purchases.ts) — see analyze-photo/index.ts
  // for the full rationale. MUST be unset together with the client flag
  // before App Store review.
  const FORCE_PRO = Deno.env.get('FORCE_PRO') === 'true';
  const { data: subRow } = await supabase.from('subscriptions').select('plan').maybeSingle();
  const isPaid = FORCE_PRO || subRow?.plan === 'pro' || subRow?.plan === 'elite';
  const AI_DAILY_LIMIT = isPaid
    ? Number(Deno.env.get('AI_COACH_LIMIT_PRO') ?? '50')
    : Number(Deno.env.get('AI_COACH_LIMIT_FREE') ?? '5');
  const { data: allowed, error: limitError } = await supabase.rpc(
    'check_and_increment_ai_usage', { p_limit: AI_DAILY_LIMIT, p_feature: 'chat' },
  );
  if (limitError) {
    console.error('rate-limit check failed:', limitError);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "You've reached today's AI limit. Try again tomorrow." }),
      { status: 429, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } },
    );
  }

  try {
    const body = await req.json();
    const { mode } = body;

    const messages = sanitizeMessages(body.messages);
    const contextNote = sanitizeProfile(body.userProfile) + buildRecoveryContext(body.recoveryTrend);

    if (!messages && mode !== 'generate_plan') {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const finalMessages = mode === 'generate_plan'
      ? [{ role: 'user', content: 'Generate a complete weekly workout plan for me based on my profile. Format it day by day.' }]
      : messages!;

    const baseMessages = [
      { role: 'system', content: SYSTEM_PROMPT + contextNote },
      ...finalMessages,
    ];

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        max_tokens: mode === 'generate_plan' ? 1024 : 512,
        messages: baseMessages,
        tools: [FOOD_LOOKUP_TOOL],
        tool_choice: 'auto',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('xAI API error:', data?.error);
      return new Response(
        JSON.stringify({ error: 'AI service unavailable. Please try again.' }),
        { status: 500, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }

    // Token accounting — lets us pull real cost data from function logs
    // instead of estimating.
    console.log('xAI usage (ai-coach, initial):', JSON.stringify(data.usage ?? {}));

    const toolCalls = data.choices?.[0]?.message?.tool_calls;
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      const toolCall = toolCalls[0];
      let query = '';
      try {
        query = JSON.parse(toolCall.function?.arguments ?? '{}').query ?? '';
      } catch (err) {
        console.error('tool call argument parse failed:', err);
      }

      const nutritionResult = query ? await lookupNutrition(query) : 'No nutrition data found for this query.';

      // Single round-trip: no `tools` this time, so the model must answer
      // in plain text from the tool result rather than calling again.
      const followUp = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${XAI_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: XAI_MODEL,
          max_tokens: mode === 'generate_plan' ? 1024 : 512,
          messages: [
            ...baseMessages,
            data.choices[0].message,
            { role: 'tool', tool_call_id: toolCall.id, content: nutritionResult },
          ],
        }),
      });

      const followUpData = await followUp.json();
      if (!followUp.ok) {
        console.error('xAI follow-up API error:', followUpData?.error);
        return new Response(
          JSON.stringify({ error: 'AI service unavailable. Please try again.' }),
          { status: 500, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
        );
      }

      console.log('xAI usage (ai-coach, tool-followup):', JSON.stringify(followUpData.usage ?? {}));

      const followUpContent = followUpData.choices?.[0]?.message?.content ?? '';
      return new Response(
        JSON.stringify({ content: followUpContent }),
        { headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }

    const content = data.choices?.[0]?.message?.content ?? '';
    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('ai-coach error:', err);
    return new Response(
      JSON.stringify({ error: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  }
});

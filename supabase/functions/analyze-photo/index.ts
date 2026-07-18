/**
 * analyze-photo Edge Function
 * Accepts a base64-encoded food image and returns calorie/macro estimates
 * via Grok vision (xAI). API key stays server-side — never exposed to clients.
 */

const RAW_ORIGINS = Deno.env.get('ALLOWED_ORIGINS') ?? '';
const ALLOWED_ORIGINS: string[] = RAW_ORIGINS
  ? RAW_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

function corsHeaders(origin: string | null): Record<string, string> {
  // CORS is browser-only; native mobile apps send no Origin header (unaffected).
  // Fail CLOSED: only reflect an explicitly allow-listed origin. An unknown
  // origin — or a missing/empty ALLOWED_ORIGINS config — gets no
  // Access-Control-Allow-Origin, so the browser blocks the response.
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

// xAI (Grok) — OpenAI-compatible API; model must be vision-capable.
const XAI_KEY        = Deno.env.get('XAI_API_KEY') ?? '';
const XAI_MODEL      = Deno.env.get('XAI_VISION_MODEL') ?? 'grok-4.20-non-reasoning';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON  = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

  // Require a valid Supabase session JWT.
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

  // Per-user daily rate limit — protects against unbounded AI-provider spend.
  // Tier-aware via public.subscriptions (mirrored by revenuecat-webhook fn;
  // missing row = free). Free 3/day backs the client's 3-lifetime taste quota
  // (the client counter is stricter); snap is otherwise a Pro feature. Counts
  // in the 'photo' bucket, independent from ai-coach's 'chat' bucket.
  const { data: subRow } = await supabase.from('subscriptions').select('plan').maybeSingle();
  const isPaid = subRow?.plan === 'pro' || subRow?.plan === 'elite';
  const PHOTO_DAILY_LIMIT = isPaid
    ? Number(Deno.env.get('PHOTO_LIMIT_PRO') ?? '30')
    : Number(Deno.env.get('PHOTO_LIMIT_FREE') ?? '3');
  const { data: allowed, error: limitError } = await supabase.rpc(
    'check_and_increment_ai_usage', { p_limit: PHOTO_DAILY_LIMIT, p_feature: 'photo' },
  );
  if (limitError) {
    console.error('rate-limit check failed:', limitError);
    return new Response(JSON.stringify({ error: 'Could not analyze photo. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "You've reached today's photo scan limit. Try again tomorrow." }),
      { status: 429, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } },
    );
  }

  try {
    const body = await req.json();
    const { base64 } = body as { base64?: string };

    if (!base64 || typeof base64 !== 'string' || base64.length < 100) {
      return new Response(JSON.stringify({ error: 'Invalid image data' }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Cap the payload: base64 inflates ~33%, so 7M chars ≈ 5 MB of image.
    // Without this, an oversized upload could drive up AI-provider cost and
    // strain the function's memory.
    const MAX_BASE64_LEN = 7_000_000;
    if (base64.length > MAX_BASE64_LEN) {
      return new Response(JSON.stringify({ error: 'Image too large. Please use a smaller photo.' }), {
        status: 413,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const PROMPT = `You are a nutrition analysis expert. Analyze the food in this photo.

Step 1 — Identify every distinct food item visible (max 10). Use visual cues
(plate diameter ~27 cm, fork/spoon size, food depth and density) to estimate
each item's portion weight in grams.

Step 2 — For each item, compute calories and macros from typical nutrition
per 100 g for that food AS PREPARED. Account for likely cooking fat
(e.g. sauteed vegetables absorb ~1 tbsp oil = ~120 kcal) and visible
dressings/sauces, either as their own items or included per item.

Step 3 — Sum the items into totals and double-check the totals are plausible
against the 4/4/9 kcal rule (protein*4 + carbs*4 + fat*9 = calories, within ~15%).

Return ONLY a valid JSON object, no markdown, exactly this shape:
{
  "name": "short dish summary, e.g. 'Grilled chicken with rice & salad'",
  "items": [
    { "name": "string", "grams": integer, "calories": integer,
      "protein": integer, "carbs": integer, "fat": integer }
  ],
  "calories": integer, "protein": integer, "carbs": integer, "fat": integer,
  "confidence": "high" | "medium" | "low",
  "notes": "one short caveat about assumptions, e.g. 'assumed 1 tbsp oil', or empty string"
}

Rules: grams and all macros are integers. confidence is "low" when portions are
hard to judge (occlusion, no size reference, mixed dishes). If the image
contains no food, return {"name": null}.`;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        max_tokens: 1024,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64}` },
              },
              {
                type: 'text',
                text: PROMPT,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('xAI API error:', data?.error);
      return new Response(
        JSON.stringify({ error: 'AI service unavailable. Please try again.' }),
        { status: 500, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } },
      );
    }

    const raw: string = data.choices?.[0]?.message?.content?.trim() ?? '';
    const clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(clean);

    // The model output is attacker-influenceable (image is user-supplied), so
    // validate and clamp before returning — never pass raw values to the client.
    const num = (v: unknown, max: number): number => {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.min(Math.round(n), max);
    };
    const name = typeof parsed?.name === 'string' && parsed.name.trim()
      ? parsed.name.trim().slice(0, 120)
      : null;

    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Could not read nutrition from this photo. Try another.' }),
        { status: 502, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } },
      );
    }

    // Itemized breakdown: clamp each entry, drop junk (no name / all-zero).
    const items = (Array.isArray(parsed.items) ? parsed.items.slice(0, 10) : [])
      .map((it: unknown) => {
        const o = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
        const itemName = typeof o.name === 'string' ? o.name.trim().slice(0, 80) : '';
        return {
          name:     itemName,
          grams:    num(o.grams, 2000),
          calories: num(o.calories, 5000),
          protein:  num(o.protein, 500),
          carbs:    num(o.carbs, 500),
          fat:      num(o.fat, 500),
        };
      })
      .filter((it) => it.name && (it.calories > 0 || it.protein > 0 || it.carbs > 0 || it.fat > 0));

    // Prefer totals recomputed from the items the user will see — keeps the
    // breakdown and the headline numbers internally consistent.
    const sum = (k: 'calories' | 'protein' | 'carbs' | 'fat', max: number) =>
      Math.min(items.reduce((s, it) => s + it[k], 0), max);
    const totals = items.length > 0
      ? { calories: sum('calories', 5000), protein: sum('protein', 500), carbs: sum('carbs', 500), fat: sum('fat', 500) }
      : {
          calories: num(parsed.calories, 5000),
          protein:  num(parsed.protein, 500),
          carbs:    num(parsed.carbs, 500),
          fat:      num(parsed.fat, 500),
        };

    const confidence = parsed.confidence === 'high' || parsed.confidence === 'low' ? parsed.confidence : 'medium';
    const notes = typeof parsed.notes === 'string' ? parsed.notes.trim().slice(0, 200) : '';

    const result = {
      name,
      ...totals,
      ...(items.length > 0 ? { items } : {}),
      confidence,
      ...(notes ? { notes } : {}),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('analyze-photo error:', err);
    return new Response(
      JSON.stringify({ error: 'Could not analyze photo. Please try again.' }),
      { status: 500, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } },
    );
  }
});

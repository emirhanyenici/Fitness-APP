/**
 * analyze-photo Edge Function
 * Accepts a base64-encoded food image and returns calorie/macro estimates
 * via Claude vision. API key stays server-side — never exposed to clients.
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

const ANTHROPIC_KEY  = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
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

  // Per-user daily rate limit — protects against unbounded Anthropic spend.
  // Photo analysis is pricier per call, so it gets a tighter default cap than
  // the text coach. Make tier-aware once the plan is persisted server-side.
  const PHOTO_DAILY_LIMIT = Number(Deno.env.get('ANALYZE_PHOTO_DAILY_LIMIT') ?? '20');
  const { data: allowed, error: limitError } = await supabase.rpc(
    'check_and_increment_ai_usage', { p_limit: PHOTO_DAILY_LIMIT },
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
    // Without this, an oversized upload could drive up Anthropic cost and
    // strain the function's memory.
    const MAX_BASE64_LEN = 7_000_000;
    if (base64.length > MAX_BASE64_LEN) {
      return new Response(JSON.stringify({ error: 'Image too large. Please use a smaller photo.' }), {
        status: 413,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
              },
              {
                type: 'text',
                text: 'Identify the food in this image. Return ONLY valid JSON with: name (string), calories (integer per serving), protein (integer grams), carbs (integer grams), fat (integer grams). No markdown, no explanation — just the JSON object.',
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data?.error);
      return new Response(
        JSON.stringify({ error: 'AI service unavailable. Please try again.' }),
        { status: 500, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } },
      );
    }

    const raw: string = data.content?.[0]?.text?.trim() ?? '';
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

    const result = {
      name,
      calories: num(parsed.calories, 5000),
      protein:  num(parsed.protein, 500),
      carbs:    num(parsed.carbs, 500),
      fat:      num(parsed.fat, 500),
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

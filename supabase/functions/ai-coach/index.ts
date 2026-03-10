import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Restrict CORS to known origins.
// Set ALLOWED_ORIGINS in Supabase dashboard → Edge Functions → Secrets
// as a comma-separated list, e.g. "https://yourapp.com,exp://localhost:8082"
const RAW_ORIGINS = Deno.env.get('ALLOWED_ORIGINS') ?? '';
const ALLOWED_ORIGINS: string[] = RAW_ORIGINS
  ? RAW_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

function corsHeaders(origin: string | null): Record<string, string> {
  // CORS is browser-only; native mobile apps send no Origin header.
  // Only allow-list known web origins; reject everything else.
  const allow = origin && ALLOWED_ORIGINS.length > 0
    ? (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0])
    : origin ?? '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const SYSTEM_PROMPT = `You are Novra AI, a personal health and fitness coach inside the Novra Health app.
You help users with personalized workout plans, nutrition advice, recovery optimization, and motivation.
Keep responses concise (2-4 sentences max unless generating a plan), friendly, and actionable.
For workout plans, format as a numbered list with sets/reps.
For nutrition, give specific food suggestions with portion sizes.
Never give medical diagnoses or replace professional medical advice.`;

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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: mode === 'generate_plan' ? 1024 : 512,
        system: SYSTEM_PROMPT + contextNote,
        messages: finalMessages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data?.error);
      return new Response(
        JSON.stringify({ error: 'AI service unavailable. Please try again.' }),
        { status: 500, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }

    const content = data.content?.[0]?.text ?? '';
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

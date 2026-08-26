/**
 * exercise-media Edge Function
 *
 * Proxies ExerciseDB (RapidAPI) so RAPIDAPI_KEY never ships in the client
 * bundle. Two modes, both requiring a valid Supabase session JWT:
 *  - POST { term, isIdLookup? } → exercise metadata search
 *      (mirrors services/exercisedb.ts's fetchFromExerciseDb() shape)
 *  - GET  ?exerciseId=NNNN      → streams the demo GIF bytes
 *      (client points <Image> at this URL + Authorization header instead of
 *      sending RapidAPI headers directly)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAW_ORIGINS = Deno.env.get('ALLOWED_ORIGINS') ?? '';
const ALLOWED_ORIGINS: string[] = RAW_ORIGINS
  ? RAW_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const EDB_BASE = 'https://exercisedb.p.rapidapi.com';

const MAX_TERM_LEN = 100;
// exerciseId as returned by ExerciseDB: short numeric/alphanumeric string.
const EXERCISE_ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

interface EdbExercise {
  id?: string;
  name?: string;
  bodyPart?: string;
  target?: string;
  equipment?: string;
  instructions?: string[];
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const url = new URL(req.url);

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: 'Forbidden origin' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  if (!RAPIDAPI_KEY) {
    console.error('exercise-media: RAPIDAPI_KEY not configured');
    return new Response(JSON.stringify({ error: 'unavailable' }), {
      status: 503, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  const rapidHeaders = {
    'X-RapidAPI-Key':  RAPIDAPI_KEY,
    'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
  };

  // ── Image proxy mode: GET ?exerciseId=NNNN ────────────────────────────────
  const exerciseId = url.searchParams.get('exerciseId');
  if (req.method === 'GET' && exerciseId) {
    if (!EXERCISE_ID_RE.test(exerciseId)) {
      return new Response(JSON.stringify({ error: 'invalid exerciseId' }), {
        status: 400, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }
    try {
      const imgRes = await fetch(`${EDB_BASE}/image?exerciseId=${encodeURIComponent(exerciseId)}&resolution=360`, {
        headers: rapidHeaders,
      });
      if (!imgRes.ok || !imgRes.body) {
        return new Response(JSON.stringify({ error: 'image fetch failed' }), {
          status: 502, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        });
      }
      return new Response(imgRes.body, {
        headers: {
          ...corsHeaders(origin),
          'Content-Type': imgRes.headers.get('content-type') ?? 'image/gif',
          'Cache-Control': 'public, max-age=604800, immutable',
        },
      });
    } catch (err) {
      console.error('exercise-media image proxy error:', err);
      return new Response(JSON.stringify({ error: 'image fetch failed' }), {
        status: 502, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }
  }

  // ── Search mode: POST { term, displayName } ────────────────────────────────
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const term = typeof body?.term === 'string' ? body.term.trim().slice(0, MAX_TERM_LEN) : '';
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim().slice(0, MAX_TERM_LEN) : term;
    if (!term) {
      return new Response(JSON.stringify({ error: 'term is required' }), {
        status: 400, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const isIdLookup = term.startsWith('id:');
    const fetchUrl = isIdLookup
      ? `${EDB_BASE}/exercises/exercise/${encodeURIComponent(term.slice(3))}`
      : `${EDB_BASE}/exercises/name/${encodeURIComponent(term)}?limit=10`;

    const res = await fetch(fetchUrl, { headers: rapidHeaders });
    if (!res.ok) {
      console.error('exercise-media: exercisedb request failed', res.status);
      return new Response(JSON.stringify({ error: 'search failed' }), {
        status: 502, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }
    const json = await res.json();
    const list: EdbExercise[] = isIdLookup ? [json as EdbExercise] : json;
    if (!Array.isArray(list) || list.length === 0) {
      return new Response(JSON.stringify({ demo: null }), {
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const normalize = (s: string) =>
      s.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/-/g, ' ').replace(/'/g, '').replace(/\s+/g, ' ').trim();
    const wantedDisplay = normalize(displayName);
    const wantedTerm = normalize(term);
    const best =
      list.find((e) => normalize(e.name ?? '') === wantedDisplay) ??
      list.find((e) => normalize(e.name ?? '') === wantedTerm) ??
      [...list].sort((a, b) => (a.name?.length ?? 999) - (b.name?.length ?? 999))[0];

    if (!best?.id) {
      return new Response(JSON.stringify({ demo: null }), {
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const demo = {
      exerciseId:   best.id,
      instructions: (best.instructions ?? []).filter((s) => s.trim().length > 0).slice(0, 6),
      bodyPart:     best.bodyPart  ?? '',
      target:       best.target    ?? '',
      equipment:    best.equipment ?? '',
    };

    return new Response(JSON.stringify({ demo }), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('exercise-media error:', err);
    return new Response(JSON.stringify({ error: 'bad request' }), {
      status: 400, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
});

/**
 * nutrition-lookup Edge Function
 *
 * Proxies USDA FoodData Central search so the USDA_API_KEY never ships in the
 * client bundle. Mirrors services/usda.ts's searchFoods() response shape.
 * Requires a valid Supabase session JWT (same pattern as ai-coach/analyze-photo).
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

const USDA_API_KEY = Deno.env.get('USDA_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const MAX_QUERY_LEN = 100;

interface UsdaNutrient {
  nutrientId: number;
  value?: number;
}

interface UsdaFood {
  fdcId: number;
  description: string;
  foodNutrients: UsdaNutrient[];
}

interface UsdaSearchResponse {
  foods?: UsdaFood[];
}

function getNutrient(nutrients: UsdaNutrient[], id: number): number {
  const n = nutrients.find((n) => n.nutrientId === id);
  return Math.round(n?.value ?? 0);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

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

  try {
    const body = await req.json().catch(() => ({}));
    const query = typeof body?.query === 'string' ? body.query.trim().slice(0, MAX_QUERY_LEN) : '';
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), {
        status: 400, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    if (!USDA_API_KEY) {
      console.error('nutrition-lookup: USDA_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'search unavailable' }), {
        status: 503, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=${USDA_API_KEY}&dataType=SR%20Legacy,Branded&pageSize=20`
    );
    if (!res.ok) {
      console.error('nutrition-lookup: USDA request failed', res.status);
      return new Response(JSON.stringify({ error: 'search failed' }), {
        status: 502, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }
    const data: UsdaSearchResponse = await res.json();
    const foods = (data.foods ?? []).map((f) => ({
      fdcId: f.fdcId,
      description: f.description,
      calories: getNutrient(f.foodNutrients, 1008),
      protein:  getNutrient(f.foodNutrients, 1003),
      carbs:    getNutrient(f.foodNutrients, 1005),
      fat:      getNutrient(f.foodNutrients, 1004),
    }));

    return new Response(JSON.stringify({ foods }), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('nutrition-lookup error:', err);
    return new Response(JSON.stringify({ error: 'bad request' }), {
      status: 400, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
});

// USDA FoodData Central search is proxied through the nutrition-lookup edge
// function — USDA_API_KEY lives server-side only, never bundled into the
// client. The Open Food Facts fallback below needs no key at all.
import { supabase } from './supabase';
import { fetchWithTimeout } from './http';

const NUTRITION_LOOKUP_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/nutrition-lookup`;

export interface FoodItem {
  fdcId: number;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ── API response shapes ──────────────────────────────────────────────────────

interface NutritionLookupResponse {
  foods?: FoodItem[];
  error?: string;
}

interface OFFNutriments {
  'energy-kcal_100g'?: number;
  'energy-kcal'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
}

interface OFFProduct {
  product_name?: string;
  nutriments?: OFFNutriments;
}

interface OFFSearchResponse {
  products?: OFFProduct[];
}

interface OFFProductResponse {
  status: number;
  product?: {
    product_name?: string;
    generic_name?: string;
    nutriments?: OFFNutriments;
  };
}

// ────────────────────────────────────────────────────────────────────────────

/**
 * Scale a food's macros by a factor (portion sizing).
 * Calories round to whole numbers; macros keep one decimal.
 * Shared by the Search quantity step and the barcode portion editor.
 */
export function scaleFood(base: FoodItem, factor: number): FoodItem {
  return {
    ...base,
    calories: Math.round(base.calories * factor),
    protein:  Math.round(base.protein  * factor * 10) / 10,
    carbs:    Math.round(base.carbs    * factor * 10) / 10,
    fat:      Math.round(base.fat      * factor * 10) / 10,
  };
}

// Simple per-session rate limiter — prevents runaway API calls
let _lastSearchTime = 0;
const SEARCH_COOLDOWN_MS = 800;

export async function searchFoods(query: string): Promise<FoodItem[]> {
  const now = Date.now();
  if (now - _lastSearchTime < SEARCH_COOLDOWN_MS) {
    throw new Error('Searching too fast. Please wait a moment.');
  }
  _lastSearchTime = now;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You must be signed in to use this feature.');

  const res = await fetchWithTimeout(NUTRITION_LOOKUP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error('Search failed');
  const data: NutritionLookupResponse = await res.json();
  return data.foods ?? [];
}

/** Search Open Food Facts (free, no key — global products including Turkish brands) */
export async function searchFoodsOFF(query: string): Promise<FoodItem[]> {
  try {
    const res = await fetchWithTimeout(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=15&fields=product_name,nutriments`
    );
    const data: OFFSearchResponse = await res.json();
    return (data.products ?? [])
      .filter((p) => p.product_name && (p.nutriments?.['energy-kcal_100g'] ?? p.nutriments?.['energy-kcal']))
      .map((p): FoodItem => {
        const n = p.nutriments!;
        return {
          fdcId: -1,  // -1 marks OFF source
          description: p.product_name!,
          calories: Math.round(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0),
          protein:  Math.round(n.proteins_100g ?? 0),
          carbs:    Math.round(n.carbohydrates_100g ?? 0),
          fat:      Math.round(n.fat_100g ?? 0),
        };
      });
  } catch {
    return [];
  }
}

/**
 * Barcode lookup via Open Food Facts (free, no key needed).
 *
 * Only returns null for a genuine "not in database" result (status !== 1).
 * Network/timeout failures are allowed to throw so callers can tell a real
 * connectivity problem apart from "product not found" instead of both
 * collapsing into the same not-found message.
 */
export async function lookupBarcode(barcode: string): Promise<FoodItem | null> {
  const res = await fetchWithTimeout(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
  const data: OFFProductResponse = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  const n = p.nutriments ?? {};
  return {
    fdcId: 0,
    description: p.product_name || p.generic_name || 'Unknown Product',
    calories: Math.round(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0),
    protein:  Math.round(n.proteins_100g ?? 0),
    carbs:    Math.round(n.carbohydrates_100g ?? 0),
    fat:      Math.round(n.fat_100g ?? 0),
  };
}

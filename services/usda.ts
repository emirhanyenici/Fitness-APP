// USDA FoodData Central key. This is a FREE, read-only, rate-limited public key
// and is EXPO_PUBLIC_* by design (bundled into the client). The FDC API only
// accepts it as an `api_key` query param — there is no header alternative — so
// it necessarily appears in the request URL. Accepted low risk: the key grants
// nothing beyond public nutrition lookups. We never log request URLs (audited),
// and the Open Food Facts fallback below needs no key at all. Future hardening,
// if ever warranted: proxy FDC calls through a Supabase edge function.
import { fetchWithTimeout } from './http';

const USDA_API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? '';

export interface FoodItem {
  fdcId: number;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ── API response shapes ──────────────────────────────────────────────────────

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

function getNutrient(nutrients: UsdaNutrient[], id: number): number {
  const n = nutrients.find((n) => n.nutrientId === id);
  return Math.round(n?.value ?? 0);
}

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

  if (!USDA_API_KEY) throw new Error('USDA API key is not configured.');

  const res = await fetchWithTimeout(
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=${USDA_API_KEY}&dataType=SR%20Legacy,Branded&pageSize=20`
  );
  if (!res.ok) throw new Error('Search failed');
  const data: UsdaSearchResponse = await res.json();
  return (data.foods ?? []).map((f) => ({
    fdcId: f.fdcId,
    description: f.description,
    calories: getNutrient(f.foodNutrients, 1008),
    protein:  getNutrient(f.foodNutrients, 1003),
    carbs:    getNutrient(f.foodNutrients, 1005),
    fat:      getNutrient(f.foodNutrients, 1004),
  }));
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

/** Barcode lookup via Open Food Facts (free, no key needed) */
export async function lookupBarcode(barcode: string): Promise<FoodItem | null> {
  try {
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
  } catch {
    return null;
  }
}

const USDA_API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? '';

export interface FoodItem {
  fdcId: number;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function getNutrient(nutrients: any[], id: number): number {
  const n = nutrients.find((n: any) => n.nutrientId === id);
  return Math.round(n?.value ?? 0);
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

  const res = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=${USDA_API_KEY}&dataType=SR%20Legacy,Branded&pageSize=20`
  );
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return (data.foods ?? []).map((f: any) => ({
    fdcId: f.fdcId,
    description: f.description,
    calories: getNutrient(f.foodNutrients, 1008),
    protein:  getNutrient(f.foodNutrients, 1003),
    carbs:    getNutrient(f.foodNutrients, 1005),
    fat:      getNutrient(f.foodNutrients, 1004),
  }));
}

/** Barcode lookup via Open Food Facts (free, no key needed) */
export async function lookupBarcode(barcode: string): Promise<FoodItem | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await res.json();
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

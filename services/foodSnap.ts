/**
 * Food photo analysis — calls the analyze-photo Supabase Edge Function.
 * The AI-provider (xAI) API key lives server-side only; it is never bundled into the app binary.
 */

import { supabase } from './supabase';
import { fetchWithTimeout } from './http';

const EDGE_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/analyze-photo`;

export interface SnapItem {
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type SnapConfidence = 'high' | 'medium' | 'low';

export interface SnapResult {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Per-item breakdown (newer server responses only). */
  items?: SnapItem[];
  confidence?: SnapConfidence;
  notes?: string;
}

const toNum = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};

/**
 * Defensive normalization of a server response into a SnapResult.
 * Tolerates the pre-itemization response shape (no items/confidence/notes)
 * and drops malformed item entries.
 */
export function sanitizeSnapResult(raw: unknown): SnapResult {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const items = (Array.isArray(o.items) ? o.items : [])
    .map((it): SnapItem => {
      const r = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
      return {
        name: typeof r.name === 'string' ? r.name.trim() : '',
        grams: toNum(r.grams),
        calories: toNum(r.calories),
        protein: toNum(r.protein),
        carbs: toNum(r.carbs),
        fat: toNum(r.fat),
      };
    })
    .filter((it) => it.name.length > 0);
  const confidence: SnapConfidence | undefined =
    o.confidence === 'high' || o.confidence === 'medium' || o.confidence === 'low'
      ? o.confidence
      : undefined;
  const notes = typeof o.notes === 'string' && o.notes.trim() ? o.notes.trim() : undefined;
  return {
    name: typeof o.name === 'string' ? o.name : '',
    calories: toNum(o.calories),
    protein: toNum(o.protein),
    carbs: toNum(o.carbs),
    fat: toNum(o.fat),
    ...(items.length > 0 ? { items } : {}),
    ...(confidence ? { confidence } : {}),
    ...(notes ? { notes } : {}),
  };
}

/**
 * @param sessionId Identifies one scanning attempt (set once per Snap screen
 * mount). Retries within the same session — re-analyzing the same photo or
 * swapping in a new one before the user confirms — are free on the server;
 * only the first charged request per session consumes the daily quota.
 */
export async function analyzeFood(base64: string, sessionId: string): Promise<SnapResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('You must be signed in to use this feature.');
  }

  // Photo analysis is heavier than a plain lookup — give it a longer budget.
  const response = await fetchWithTimeout(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ base64, sessionId }),
  }, 30_000);

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `Server error ${response.status}`);
  }

  return sanitizeSnapResult(await response.json());
}

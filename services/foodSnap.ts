/**
 * Food photo analysis — calls the analyze-photo Supabase Edge Function.
 * The AI-provider (xAI) API key lives server-side only; it is never bundled into the app binary.
 */

import { supabase } from './supabase';
import { fetchWithTimeout } from './http';

const EDGE_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/analyze-photo`;

export interface SnapResult {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export async function analyzeFood(base64: string): Promise<SnapResult> {
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
    body: JSON.stringify({ base64 }),
  }, 30_000);

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `Server error ${response.status}`);
  }

  return response.json() as Promise<SnapResult>;
}

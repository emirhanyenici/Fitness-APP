/**
 * Thin client for TypeSafe's Jev (System One) HTTP API.
 * Key lives only in Supabase secrets:  supabase secrets set TYPESAFE_API_KEY=...
 * Never exposed to the app. Every failure path returns null (fail-open) so the
 * AI features keep working without Jev. Request state is never logged.
 */
import type { NoulQuestion, Probs } from './jevPolicy.ts';

// Accepts either secret name (the dashboard secret was created as TypeSafe_JEV_API_Key).
const API_KEY = Deno.env.get('TYPESAFE_API_KEY') ?? Deno.env.get('TypeSafe_JEV_API_Key') ?? '';
const MODEL   = Deno.env.get('TYPESAFE_MODEL') ?? 'jev-latest';
const URL_    = 'https://api.typesafe.ai/v1/systemone';

/** Ask several independent Noul questions about one state; returns name → P(yes). */
export async function jevNouls(
  req: { state: unknown; questions: Record<string, NoulQuestion> },
  timeoutMs = 2500,
): Promise<Probs> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(URL_, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, state: req.state, questions: req.questions }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.error('Jev HTTP error:', res.status);
      return null;
    }
    const data = await res.json();
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(data?.answers ?? {})) {
      const n = (v as { noul?: unknown })?.noul;
      if (typeof n === 'number' && Number.isFinite(n)) out[k] = n;
    }
    console.log('Jev usage:', JSON.stringify(data?.usage ?? {}));
    return out;
  } catch (err) {
    console.error('Jev call failed (continuing without it):', err instanceof Error ? err.message : 'unknown');
    return null;
  }
}

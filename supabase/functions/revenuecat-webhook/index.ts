/**
 * revenuecat-webhook Edge Function
 *
 * Receives RevenueCat webhook events and mirrors the user's entitlement into
 * public.subscriptions so other edge functions can apply tier-aware limits.
 *
 * Security: RevenueCat is configured (dashboard → Integrations → Webhooks)
 * to send a fixed Authorization header. We compare it against the
 * RC_WEBHOOK_SECRET secret and fail closed. Writes use the service role key
 * (bypasses RLS); clients have no write path to the table.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RC_WEBHOOK_SECRET = Deno.env.get('RC_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Map a RevenueCat event to the plan it implies, or null to ignore the event. */
export function planFromEvent(event: Record<string, unknown>): 'free' | 'pro' | 'elite' | null {
  const type = String(event.type ?? '');
  // Expiration ends access. CANCELLATION only disables auto-renew — the sub
  // stays active until EXPIRATION, so it must NOT downgrade.
  if (type === 'EXPIRATION') return 'free';

  const ids: string[] = Array.isArray(event.entitlement_ids)
    ? (event.entitlement_ids as string[])
    : typeof event.entitlement_id === 'string' ? [event.entitlement_id] : [];

  const GRANTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE', 'SUBSCRIPTION_EXTENDED', 'TRANSFER']);
  if (!GRANTS.has(type)) return null; // TEST, CANCELLATION, BILLING_ISSUE, etc. — no plan change

  if (ids.includes('elite')) return 'elite';
  if (ids.includes('pro'))   return 'pro';
  return null; // grant event without a known entitlement — ignore
}

Deno.serve(async (req) => {
  // Fail closed: no secret configured, or header mismatch → reject.
  const auth = req.headers.get('authorization') ?? '';
  if (!RC_WEBHOOK_SECRET || auth !== RC_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const event = (body?.event ?? {}) as Record<string, unknown>;
    const appUserId = String(event.app_user_id ?? '');

    // Anonymous RevenueCat ids ($RCAnonymousID:...) are not Supabase users —
    // acknowledge so RevenueCat doesn't retry, but store nothing.
    if (!UUID_RE.test(appUserId)) {
      return new Response(JSON.stringify({ ok: true, skipped: 'non-uuid app_user_id' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const plan = planFromEvent(event);
    if (plan === null) {
      return new Response(JSON.stringify({ ok: true, skipped: `event type ${event.type}` }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { error } = await supabase
      .from('subscriptions')
      .upsert({ user_id: appUserId, plan, updated_at: new Date().toISOString() });

    if (error) {
      console.error('subscriptions upsert failed:', error.message);
      // Non-200 → RevenueCat retries with backoff, which is what we want.
      return new Response(JSON.stringify({ error: 'upsert failed' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, plan }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('revenuecat-webhook error:', err);
    return new Response(JSON.stringify({ error: 'bad request' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
});

/**
 * apple-token-exchange Edge Function
 *
 * Immediately after a native Sign in with Apple, exchanges the short-lived
 * authorization code for a long-lived Apple refresh token and stores it
 * server-side (public.apple_tokens, service-role only). This refresh token
 * is what lets delete-account revoke the user's "Sign in with Apple"
 * authorization on account deletion (Apple Guideline 5.1.1(v)) — Apple's
 * authorization code itself expires in ~5 minutes and cannot be stored for
 * later use, so this exchange must happen right at sign-in time.
 *
 * Best-effort by design: the client fires this without awaiting/surfacing
 * failures — sign-in must never be blocked by this. A user for whom this
 * fails simply won't have their Apple grant revoked on deletion later;
 * delete-account degrades gracefully (proceeds without failing) when no
 * token is on file.
 *
 * Security: same pattern as delete-account — caller must present their own
 * valid session JWT, the user id is taken from the verified token.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildAppleClientSecret } from '../_shared/appleClientSecret.ts';

const RAW_ORIGINS = Deno.env.get('ALLOWED_ORIGINS') ?? '';
const ALLOWED_ORIGINS: string[] = RAW_ORIGINS
  ? RAW_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APPLE_CLIENT_ID  = Deno.env.get('APPLE_CLIENT_ID') ?? '';

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
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

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const authorizationCode = String(body?.authorizationCode ?? '');
    if (!authorizationCode) {
      return new Response(JSON.stringify({ error: 'authorizationCode required' }), {
        status: 400, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const clientSecret = await buildAppleClientSecret();
    const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: APPLE_CLIENT_ID,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      console.error('apple token exchange failed:', tokenRes.status, await tokenRes.text());
      return new Response(JSON.stringify({ ok: false }), {
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const tokenJson = await tokenRes.json();
    const refreshToken = String(tokenJson.refresh_token ?? '');
    if (!refreshToken) {
      return new Response(JSON.stringify({ ok: false }), {
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { error: upsertError } = await admin
      .from('apple_tokens')
      .upsert({ user_id: user.id, refresh_token: refreshToken, updated_at: new Date().toISOString() });

    if (upsertError) {
      console.error('apple_tokens upsert failed:', upsertError.message);
    }

    return new Response(JSON.stringify({ ok: !upsertError }), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('apple-token-exchange error:', err);
    return new Response(JSON.stringify({ ok: false }), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
});

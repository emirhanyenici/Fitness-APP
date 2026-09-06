/**
 * Builds Apple's client_secret JWT (ES256, signed with the Sign in with
 * Apple private key) — required by both the token-exchange endpoint
 * (apple-token-exchange) and the revoke endpoint (delete-account).
 * See https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
 *
 * Requires 4 secrets set via `supabase secrets set`:
 *   APPLE_TEAM_ID     — Apple Developer Team ID (top-right of the portal)
 *   APPLE_KEY_ID      — Key ID of a Sign in with Apple-enabled key
 *   APPLE_CLIENT_ID   — the app's bundle identifier (com.zenova.lifescore)
 *   APPLE_PRIVATE_KEY — the .p8 private key file's contents, PEM format
 *                       (PKCS8, "-----BEGIN PRIVATE KEY-----...")
 */
import { SignJWT, importPKCS8 } from 'https://esm.sh/jose@5';

export async function buildAppleClientSecret(): Promise<string> {
  const teamId = Deno.env.get('APPLE_TEAM_ID') ?? '';
  const keyId = Deno.env.get('APPLE_KEY_ID') ?? '';
  const clientId = Deno.env.get('APPLE_CLIENT_ID') ?? '';
  // Secrets set via the CLI/dashboard often escape real newlines as `\n` —
  // normalize back to actual newlines for PEM parsing.
  const privateKeyPem = (Deno.env.get('APPLE_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n');

  if (!teamId || !keyId || !clientId || !privateKeyPem) {
    throw new Error('Apple Sign-In secrets not configured (APPLE_TEAM_ID/APPLE_KEY_ID/APPLE_CLIENT_ID/APPLE_PRIVATE_KEY)');
  }

  const privateKey = await importPKCS8(privateKeyPem, 'ES256');
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 300) // short-lived — only needs to survive one immediate call
    .setAudience('https://appleid.apple.com')
    .setSubject(clientId)
    .sign(privateKey);
}

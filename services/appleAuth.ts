/**
 * Sign in with Apple — native flow (iOS only).
 *
 * The expo-apple-authentication module is loaded lazily so that platforms
 * without the native module (Android, web, Jest, or a dev build made before
 * this feature) never touch it. Callers gate on Platform.OS === 'ios' and
 * isAvailableAsync() before showing any Apple UI.
 */
import * as Crypto from 'expo-crypto';

export interface AppleCredentialResult {
  identityToken: string;
  /** Raw nonce to pass to supabase.auth.signInWithIdToken (Apple got its SHA-256). */
  rawNonce: string;
  /** Only provided by Apple on the very first authorization for this app. */
  fullName: string | null;
}

/** Thrown code when the user dismisses the native Apple sheet. */
export const APPLE_CANCELED = 'ERR_REQUEST_CANCELED';

export async function signInWithAppleNative(): Promise<AppleCredentialResult> {
  const AppleAuthentication = await import('expo-apple-authentication');

  // Replay protection: Apple embeds the hashed nonce in the identity token;
  // Supabase verifies it against the raw nonce we send alongside the token.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  const nameParts = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ');

  return {
    identityToken: credential.identityToken,
    rawNonce,
    fullName: nameParts || null,
  };
}

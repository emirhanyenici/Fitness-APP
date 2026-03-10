import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
import { useFonts, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PostHogProvider } from 'posthog-react-native';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/authStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { colors } from '../constants/colors';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
// PostHog requires a project key (phc_...). Personal keys (phx_...) are rejected with 401.
const POSTHOG_ENABLED = POSTHOG_KEY.startsWith('phc_');

// Only process deep links that originate from our own app scheme.
const APP_SCHEME = 'novra-health://';

/**
 * Minimal structural check: a valid Supabase JWT has exactly 3 dot-separated
 * base64url parts. Rejects obviously forged or garbage tokens before
 * passing them to the Supabase SDK.
 */
function isJWTShaped(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every((p) => /^[A-Za-z0-9_=+-]+$/.test(p));
}

const queryClient = new QueryClient();

export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession);
  const [appReady, setAppReady] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    Outfit_700Bold,
    Outfit_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
    SpaceMono_400Regular,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      // Subscription status defaults to free.
      // Real plan is enforced server-side via RevenueCat → Supabase webhook.
      // Never derive plan from email or any other client-controllable value.
      useSubscriptionStore.getState().setPlan('free');

      if (event === 'PASSWORD_RECOVERY') {
        setTimeout(() => router.replace('/(auth)/reset-password'), 300);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Handle deep links for password recovery.
  // Only URLs from our own app scheme are processed.
  // Tokens are validated for minimal JWT structure before being handed to Supabase.
  useEffect(() => {
    const handleUrl = (url: string) => {
      if (!url.startsWith(APP_SCHEME)) return;
      if (!url.includes('type=recovery')) return;

      const hash = url.split('#')[1] ?? '';
      // Split on the FIRST '=' only — preserves base64 padding in JWT segments.
      const params: Record<string, string> = Object.fromEntries(
        hash.split('&').map((p) => {
          const idx = p.indexOf('=');
          return idx === -1 ? [p, ''] : [p.slice(0, idx), decodeURIComponent(p.slice(idx + 1))];
        })
      );
      const { access_token, refresh_token } = params;
      if (
        access_token && refresh_token &&
        isJWTShaped(access_token) && isJWTShaped(refresh_token)
      ) {
        supabase.auth.setSession({ access_token, refresh_token });
      }
    };
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  // Mark app as ready when fonts are loaded or errored (with timeout fallback)
  useEffect(() => {
    if (fontsLoaded || fontError) {
      setAppReady(true);
    }
    // Fallback: if fonts take too long, show app anyway after 3 seconds
    const timeout = setTimeout(() => setAppReady(true), 3000);
    return () => clearTimeout(timeout);
  }, [fontsLoaded, fontError]);

  if (!appReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.accent.primary} />
        <Text style={{ color: colors.text.secondary, marginTop: 16, fontSize: 14 }}>Loading...</Text>
      </View>
    );
  }

  const inner = (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.primary } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modals/add-food" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modals/log-workout" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modals/ai-coach" options={{ presentation: 'modal' }} />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );

  return POSTHOG_ENABLED
    ? <PostHogProvider apiKey={POSTHOG_KEY} options={{ host: POSTHOG_HOST, enableSessionReplay: false }} autocapture={false}>{inner}</PostHogProvider>
    : inner;
}


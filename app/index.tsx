import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useUserStore } from '../stores/userStore';
import { colors } from '../constants/colors';

/**
 * Give slow/broken secure storage a hard ceiling: if the session or persist
 * hydration hasn't resolved by then, proceed with whatever we have rather
 * than stranding the user on the splash forever. Mirrors the 5s guard in
 * services/sync.ts waitForStoreHydration.
 */
const HYDRATION_TIMEOUT_MS = 5000;

/** True once the userStore persist middleware finished rehydrating from disk. */
function useUserStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useUserStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useUserStore.persist.onFinishHydration(() => setHydrated(true));
    // Hydration may have finished between the initial render and subscribing.
    if (useUserStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

export default function RootIndex() {
  const session         = useAuthStore((s) => s.session);
  const sessionResolved = useAuthStore((s) => s.sessionResolved);
  const isOnboarded     = useUserStore((s) => s.isOnboarded);
  const storeHydrated   = useUserStoreHydrated();

  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), HYDRATION_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  // F9: don't route until the persisted session and profile have been read
  // back from secure storage. Redirecting while `session` is still the
  // pre-hydration null dropped logged-in users onto the login screen on every
  // cold start / full reload, with no redirect back once hydration finished.
  if (!(sessionResolved && storeHydrated) && !timedOut) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!isOnboarded) return <Redirect href="/(onboarding)/chat" />;
  return <Redirect href="/(tabs)" />;
}

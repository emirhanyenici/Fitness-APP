import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useUserStore } from '../stores/userStore';

export default function RootIndex() {
  const session = useAuthStore((s) => s.session);
  const isOnboarded = useUserStore((s) => s.isOnboarded);

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!isOnboarded) return <Redirect href="/(onboarding)/chat" />;
  return <Redirect href="/(tabs)" />;
}

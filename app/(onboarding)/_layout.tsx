import { Stack } from 'expo-router';
import { colors } from '../../constants/colors';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.primary } }} />
  );
}

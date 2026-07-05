import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  FadeIn, FadeInDown, FadeInUp,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import { colors, withAlpha } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { DISCLAIMER_SHORT } from '../../constants/legal';
import { Button } from '../../components/ui/Button';
import { useT } from '../../constants/i18n';

export default function WelcomeScreen() {
  const t = useT();

  // Slow "breathing" on the main blob — the only looping motion; the rest is
  // a one-shot staggered entrance (T7: brand moment, kept measured).
  const breathe = useSharedValue(1);
  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1.08, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breathe]);
  const breatheStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }));

  return (
    <View style={styles.container}>
      {/* Layered organic backdrop */}
      <Animated.View style={[styles.blob, styles.blobMain, breatheStyle]} />
      <View style={[styles.blob, styles.blobTeal]} />
      <View style={[styles.blob, styles.blobLime]} />

      <View style={styles.center}>
        <Animated.Text entering={FadeInDown.duration(600)} style={styles.logo}>
          ZENOVA
        </Animated.Text>
        <Animated.View entering={FadeIn.delay(300).duration(500)} style={styles.underline} />
        <Animated.Text entering={FadeInDown.delay(250).duration(600)} style={styles.tagline}>
          {t('onboarding.tagline')}
        </Animated.Text>
        <View style={{ height: spacing['2xl'] }} />
        <Animated.View entering={FadeInUp.delay(550).duration(600)} style={{ width: '100%' }}>
          <Button
            label={t('onboarding.getStartedArrow')}
            onPress={() => router.replace('/(onboarding)/chat')}
            accessibilityLabel={t('onboarding.getStartedA11y')}
          />
        </Animated.View>

        <Animated.Text entering={FadeIn.delay(800).duration(500)} style={styles.disclaimer}>
          {t('onboarding.disclaimerPrefix', { disclaimer: DISCLAIMER_SHORT })}
        </Animated.Text>
      </View>
      <Text style={styles.version}>v1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
  },
  blobMain: {
    top: -120,
    alignSelf: 'center',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: withAlpha(colors.accent.primary, 0.10),
  },
  blobTeal: {
    top: 120,
    right: -140,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: withAlpha(colors.status.info, 0.08),
  },
  blobLime: {
    bottom: -80,
    left: -110,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: withAlpha(colors.status.success, 0.08),
  },
  center: {
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
    width: '100%',
  },
  logo: {
    fontFamily: typography.fonts.display,
    fontSize: typography.sizes['5xl'],
    color: colors.text.primary,
    letterSpacing: 8,
  },
  underline: {
    width: 120,
    height: 2,
    backgroundColor: colors.accent.primary,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    borderRadius: radius.full,
  },
  tagline: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.sizes.md * typography.lineHeights.loose,
  },
  disclaimer: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: typography.sizes.xs * typography.lineHeights.loose,
    marginTop: spacing.base,
    paddingHorizontal: spacing.sm,
  },
  version: {
    position: 'absolute',
    bottom: 40,
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
  },
});

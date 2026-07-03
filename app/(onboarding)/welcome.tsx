import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { DISCLAIMER_SHORT } from '../../constants/legal';
import { useT } from '../../constants/i18n';

export default function WelcomeScreen() {
  const t = useT();
  return (
    <View style={styles.container}>
      <View style={styles.glow} />
      <View style={styles.center}>
        <Text style={styles.logo}>ZENOVA</Text>
        <View style={styles.underline} />
        <Text style={styles.tagline}>{t('onboarding.tagline')}</Text>
        <View style={{ height: spacing['2xl'] }} />
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(onboarding)/chat')} accessibilityRole="button" accessibilityLabel={t('onboarding.getStartedA11y')}>
          <Text style={styles.primaryBtnText}>{t('onboarding.getStartedArrow')}</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          {t('onboarding.disclaimerPrefix', { disclaimer: DISCLAIMER_SHORT })}
        </Text>
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
  },
  glow: {
    position: 'absolute',
    top: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: colors.accent.dim,
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
  primaryBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.full,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: typography.fonts.display,
    fontSize: typography.sizes.base,
    color: colors.text.inverse,
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

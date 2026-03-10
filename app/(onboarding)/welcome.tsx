import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.glow} />
      <View style={styles.center}>
        <Text style={styles.logo}>NOVRA</Text>
        <View style={styles.underline} />
        <Text style={styles.tagline}>Your AI health coach.{'\n'}Finally, one that thinks.</Text>
        <View style={{ height: spacing['2xl'] }} />
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(onboarding)/chat')}>
          <Text style={styles.primaryBtnText}>Get Started →</Text>
        </TouchableOpacity>
        <View style={{ height: spacing.base }} />
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.ghostLink}>← Back to Login</Text>
        </TouchableOpacity>
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
  ghostLink: {
    fontFamily: typography.fonts.body,
    fontSize: 14,
    color: colors.text.tertiary,
  },
  version: {
    position: 'absolute',
    bottom: 40,
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
  },
});

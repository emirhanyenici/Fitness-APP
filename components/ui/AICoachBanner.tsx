import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';

interface Props {
  subtitle: string;
  style?: object;
}

export function AICoachBanner({ subtitle, style }: Props) {
  return (
    <TouchableOpacity
      style={[styles.banner, style]}
      onPress={() => router.push('/modals/ai-coach' as any)}
      activeOpacity={0.85}
    >
      <View style={styles.left}>
        <View style={styles.icon}>
          <Text style={{ fontSize: 18 }}>✦</Text>
        </View>
        <View>
          <Text style={styles.title}>AI Coach</Text>
          <Text style={styles.sub}>{subtitle}</Text>
        </View>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accent.dim,
    borderWidth: 1,
    borderColor: colors.accent.primary + '40',
    borderRadius: radius.xl,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  left:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon:  { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent.primary + '20', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.accent.primary },
  sub:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.accent.primary + 'BB', marginTop: 1 },
  arrow: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xl, color: colors.accent.primary },
});

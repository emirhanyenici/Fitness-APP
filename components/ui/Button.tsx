import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { elevation } from '../../constants/elevation';
import { Icon, type IconComponent } from './Icon';

/**
 * Shared CTA button (finding T8). One recipe app-wide:
 *  - radius.full pill, paddingVertical 16 (md: 12)
 *  - activeOpacity 0.85 for CTAs (list rows stay TouchableOpacity 0.7)
 *  - label in Outfit display, optional secondary line (subLabel)
 */
export type ButtonVariant = 'primary' | 'success' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** 'lg' 16px vertical padding (default CTA) / 'md' 12px compact */
  size?: 'lg' | 'md';
  subLabel?: string;
  icon?: IconComponent;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label, onPress, variant = 'primary', size = 'lg', subLabel, icon,
  disabled = false, loading = false, accessibilityLabel, style,
}: ButtonProps) {
  const inactive = disabled || loading;
  const labelColor =
    variant === 'primary' || variant === 'success' ? colors.text.inverse :
    variant === 'danger'  ? colors.status.danger :
    variant === 'ghost'   ? colors.text.secondary :
    colors.text.primary;

  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], size === 'md' && styles.md, inactive && styles.disabled, style]}
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <View style={styles.inner}>
          {icon && <Icon icon={icon} size="md" color={labelColor} />}
          <View style={styles.labels}>
            <Text style={[styles.label, size === 'md' && styles.labelMd, { color: labelColor }]}>{label}</Text>
            {subLabel != null && <Text style={[styles.subLabel, { color: labelColor }]}>{subLabel}</Text>}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: { paddingVertical: spacing.md },
  inner:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  labels: { alignItems: 'center' },

  primary:   { backgroundColor: colors.accent.primary, ...elevation.card, shadowColor: colors.shadow.accent },
  success:   { backgroundColor: colors.status.success, ...elevation.card },
  secondary: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.default },
  ghost:     { backgroundColor: 'transparent' },
  danger:    { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.status.danger },
  disabled:  { opacity: 0.45 },

  label:    { fontFamily: typography.fonts.display, fontSize: typography.sizes.base },
  labelMd:  { fontSize: typography.sizes.sm },
  subLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, opacity: 0.75, marginTop: 3 },
});

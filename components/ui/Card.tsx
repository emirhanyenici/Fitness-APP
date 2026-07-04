import type { ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, withAlpha } from '../../constants/colors';
import { elevation } from '../../constants/elevation';
import { spacing, radius } from '../../constants/spacing';

/**
 * Shared surface component (finding T8 — stops every screen redefining its own
 * card recipe). Radius rule app-wide: card 20 (radius.xl), hero/sheet 24
 * (radius['2xl']), button full.
 *
 *  - 'card'   default content card + subtle shadow
 *  - 'raised' emphasized card (accent-tinted border, stronger shadow)
 *  - 'hero'   flagship surface — one per screen, 24 radius, accent border
 */
export type CardVariant = 'card' | 'raised' | 'hero';

interface CardProps {
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export function Card({ variant = 'card', style, children }: CardProps) {
  return <View style={[styles.base, styles[variant], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.xl,
    padding: spacing.base,
  },
  card:   { ...elevation.card },
  raised: { ...elevation.raised, borderColor: withAlpha(colors.accent.primary, 0.13) },
  hero:   {
    ...elevation.hero,
    borderRadius: radius['2xl'],
    borderColor: withAlpha(colors.accent.primary, 0.21),
  },
});

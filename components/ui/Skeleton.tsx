import { useEffect } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle, type DimensionValue } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';

/**
 * Pulsing placeholder block (finding T11 — loading states were bare
 * ActivityIndicator/text swaps). Compose rows of these to sketch the
 * shape of the content being fetched.
 */
interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 14, borderRadius = radius.sm, style }: SkeletonProps) {
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: colors.bg.elevated }, pulseStyle, style]}
    />
  );
}

/** List-row placeholder: icon square + two text lines (search results). */
export function SkeletonRow({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, style]}>
      <Skeleton width={40} height={40} borderRadius={radius.md} />
      <View style={styles.rowLines}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="45%" height={11} />
      </View>
    </View>
  );
}

/** Paragraph placeholder: heading + body lines (report/AI content). */
export function SkeletonParagraph({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.paragraph, style]}>
      <Skeleton width="40%" height={16} />
      <Skeleton />
      <Skeleton />
      <Skeleton width="80%" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowLines: { flex: 1, gap: 6 },
  paragraph: { gap: spacing.sm },
});

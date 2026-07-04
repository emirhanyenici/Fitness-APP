import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { colors } from '../../constants/colors';

/**
 * Horizontal progress bar whose fill animates to `pct` (finding T3 — progress
 * bars previously snapped to their value with zero motion). Drop-in for the
 * hand-rolled barBg/barFill pairs on Home stats, nutrition macros, and the
 * recovery sleep bar.
 */
interface AnimatedBarProps {
  /** 0..1 fill fraction */
  pct: number;
  color: string;
  height?: number;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedBar({
  pct, color, height = 4, trackColor = colors.bg.elevated, style,
}: AnimatedBarProps) {
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(Math.min(1, Math.max(0, pct)), {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  return (
    <Animated.View
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }, style]}
    >
      <Animated.View
        style={[styles.fill, { borderRadius: height / 2, backgroundColor: color }, fillStyle]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill:  { height: '100%' },
});

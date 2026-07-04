import { useEffect, type ReactNode } from 'react';
import { View, TextInput, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, Easing,
} from 'react-native-reanimated';
import { withAlpha } from '../../constants/colors';

/**
 * Real SVG progress ring (finding T2 — replaces the fake full-circle
 * borderWidth "ring" that looked identical at score 12 and 98). The arc fills
 * to `progress` and animates from its previous value on mount/change.
 * Used by the Home hero (180px) and the Profile mini ring (54px).
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING_TIMING = { duration: 900, easing: Easing.out(Easing.cubic) };

interface ProgressRingProps {
  /** 0..1 fill fraction */
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor?: string;
  children?: ReactNode;
}

export function ProgressRing({
  progress, size, strokeWidth, color, trackColor, children,
}: ProgressRingProps) {
  // Default track = translucent tint of the fill color, so the full circle
  // stays visible on white cards even at score 0.
  const track = trackColor ?? withAlpha(color, 0.13);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));

  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(clamped, RING_TIMING);
  }, [clamped, fill]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - fill.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      {/* Rotate -90° so the arc starts at 12 o'clock */}
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={track} strokeWidth={strokeWidth} fill="none"
        />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
        />
      </Svg>
      {children != null && <View style={styles.center}>{children}</View>}
    </View>
  );
}

/**
 * Animated integer count-up (0 → value) rendered via a read-only TextInput —
 * reanimated can update its `text` prop on the UI thread without re-rendering
 * React on every frame.
 */
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface CountUpTextProps {
  value: number;
  style?: StyleProp<TextStyle>;
}

export function CountUpText({ value, style }: CountUpTextProps) {
  const sv = useSharedValue(0);
  useEffect(() => {
    sv.value = withTiming(value, RING_TIMING);
  }, [value, sv]);

  const animatedProps = useAnimatedProps(() => ({
    text: String(Math.round(sv.value)),
    // `text` is valid on TextInput but missing from the animated-props type
  }) as any);

  return (
    <AnimatedTextInput
      editable={false}
      defaultValue="0"
      animatedProps={animatedProps}
      style={[styles.countUp, style]}
      accessibilityLabel={String(value)}
    />
  );
}

const styles = StyleSheet.create({
  center:  { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  countUp: { padding: 0, textAlign: 'center', includeFontPadding: false },
});

import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle, type AccessibilityRole } from 'react-native';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing } from '../../constants/spacing';

/**
 * Shared "N of M" segment indicator (finding T10 — streak dots, recovery
 * rating bars and water squares each spoke a different visual language).
 * One rounded-pill dialect for all of them: filled = solid `color`,
 * outline = empty pill with `color` border (e.g. "today"), empty = neutral
 * border. Segments flex to fill the row; pass `onPressSegment` to make
 * them tappable and `labels` for per-segment captions (streak weekdays).
 */
interface SegmentMeterProps {
  count: number;
  /** Prefix fill count, or a predicate for non-contiguous fills (streak days). */
  filled: number | ((index: number) => boolean);
  color: string;
  height?: number;
  /** Index drawn as an outlined pill when not filled (e.g. today's slot). */
  outlineIndex?: number;
  /** Optional caption under each segment; must have `count` items. */
  labels?: string[];
  /** Caption index emphasised with `color` (e.g. today). */
  highlightLabelIndex?: number;
  onPressSegment?: (index: number) => void;
  segmentA11y?: (index: number, isFilled: boolean) => {
    label: string;
    role?: AccessibilityRole;
    selected?: boolean;
  };
  style?: StyleProp<ViewStyle>;
}

export function SegmentMeter({
  count, filled, color, height = 12, outlineIndex, labels,
  highlightLabelIndex, onPressSegment, segmentA11y, style,
}: SegmentMeterProps) {
  const isFilled = typeof filled === 'function' ? filled : (i: number) => i < filled;

  return (
    <View style={[styles.row, style]}>
      {Array.from({ length: count }).map((_, i) => {
        const fill = isFilled(i);
        const pillStyle = [
          styles.pill,
          { height, borderRadius: height / 2 },
          fill
            ? { backgroundColor: color, borderColor: color }
            : i === outlineIndex
              ? { backgroundColor: 'transparent', borderColor: color }
              : { backgroundColor: 'transparent', borderColor: colors.border.default },
        ];
        const a11y = segmentA11y?.(i, fill);
        const pill = onPressSegment ? (
          <TouchableOpacity
            style={pillStyle}
            onPress={() => onPressSegment(i)}
            activeOpacity={0.7}
            accessibilityRole={a11y?.role ?? 'button'}
            accessibilityState={a11y?.selected !== undefined ? { selected: a11y.selected } : undefined}
            accessibilityLabel={a11y?.label}
            hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
          />
        ) : (
          <View style={pillStyle} accessibilityLabel={a11y?.label} />
        );

        return (
          <View key={i} style={styles.col}>
            {pill}
            {labels && (
              <Text
                style={[
                  styles.label,
                  i === highlightLabelIndex && { color, fontFamily: typography.fonts.bodyMed },
                ]}
              >
                {labels[i]}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', gap: spacing.sm },
  col:   { flex: 1, alignItems: 'stretch', gap: 4 },
  pill:  { borderWidth: 1.5 },
  label: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});

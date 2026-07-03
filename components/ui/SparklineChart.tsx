import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { typography } from '../../constants/typography';
import { colors } from '../../constants/colors';

interface Props {
  data: number[];        // 7 values 0–100
  color: string;
  labels?: string[];     // e.g. ['M','T','W','T','F','S','S']
  width?: number;
  height?: number;
  highlightLast?: boolean;
}

export function SparklineChart({
  data,
  color,
  labels,
  width = 280,
  height = 72,
  highlightLast = true,
}: Props) {
  if (!data || data.length < 2) return null;

  const padH = 10;
  const padV = 8;
  const chartW = width  - padH * 2;
  const chartH = height - padV * 2;

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range  = maxVal - minVal || 1;

  const points = data.map((v, i) => ({
    x: padH + (i / (data.length - 1)) * chartW,
    y: padV + chartH - ((v - minVal) / range) * chartH,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const lastPoint = points[points.length - 1];

  return (
    <View style={{ width }}>
      <Svg width={width} height={height}>
        {/* Baseline */}
        <Line
          x1={padH}  y1={height - padV}
          x2={width - padH} y2={height - padV}
          stroke={color + '20'}
          strokeWidth={1}
        />
        {/* Line */}
        <Polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color + '80'} />
        ))}
        {/* Highlight last dot */}
        {highlightLast && (
          <Circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill={color} />
        )}
      </Svg>

      {labels && labels.length === data.length && (
        <View style={[styles.labels, { paddingHorizontal: padH }]}>
          {labels.map((l, i) => (
            <Text
              key={i}
              style={[styles.label, i === labels.length - 1 && { color, fontFamily: typography.fonts.bodyMed }]}
            >
              {l}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  label:  { fontFamily: typography.fonts.body, fontSize: 10, color: colors.text.tertiary },
});

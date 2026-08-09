import { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../stores/userStore';
import { useMeasurementLogStore, type MeasurementEntry, type MeasurementField } from '../../stores/measurementLogStore';
import { isValidMeasurementCm } from '../../services/recommendations';
import { withAlpha, type Colors } from '../../constants/colors';
import { useColors } from '../../constants/useColors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { useT } from '../../constants/i18n';
import { Icon, ArrowLeft } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';

const FIELDS: { key: MeasurementField; labelKey: string }[] = [
  { key: 'waist_cm', labelKey: 'measurements.waist' },
  { key: 'chest_cm', labelKey: 'measurements.chest' },
  { key: 'arm_cm',   labelKey: 'measurements.arm' },
  { key: 'hips_cm',  labelKey: 'measurements.hips' },
  { key: 'thigh_cm', labelKey: 'measurements.thigh' },
];

function cmToIn(cm: number) { return Math.round((cm / 2.54) * 10) / 10; }
function inToCm(inch: number) { return Math.round(inch * 2.54 * 10) / 10; }

function latestEntry(entries: MeasurementEntry[]): MeasurementEntry | undefined {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export default function AddMeasurementModal() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const profile = useUserStore((s) => s.profile);
  const units = profile?.units ?? 'metric';
  const entries = useMeasurementLogStore((s) => s.entries);
  const addEntry = useMeasurementLogStore((s) => s.addEntry);

  const latest = useMemo(() => latestEntry(entries), [entries]);
  const [drafts, setDrafts] = useState<Record<MeasurementField, string>>(() => {
    const initial = {} as Record<MeasurementField, string>;
    for (const f of FIELDS) {
      const cm = latest?.[f.key];
      initial[f.key] = cm ? String(units === 'imperial' ? cmToIn(cm) : cm) : '';
    }
    return initial;
  });

  const handleSave = () => {
    const fields: Partial<Omit<MeasurementEntry, 'date'>> = {};
    for (const f of FIELDS) {
      const raw = drafts[f.key].trim();
      if (!raw) continue;
      const parsed = parseFloat(raw);
      if (!Number.isFinite(parsed)) continue;
      const cm = units === 'imperial' ? inToCm(parsed) : parsed;
      if (!isValidMeasurementCm(cm)) {
        Alert.alert(t('common.error'), t('measurements.rangeError'));
        return;
      }
      fields[f.key] = cm;
    }
    if (Object.keys(fields).length === 0) {
      router.back();
      return;
    }
    addEntry(fields);
    router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Icon icon={ArrowLeft} size="lg" color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('measurements.addTitle')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <Text style={styles.sectionSub}>{t('measurements.sectionSub')}</Text>

      <View style={styles.card}>
        {FIELDS.map((f, i) => (
          <View key={f.key} style={[styles.row, i === FIELDS.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>{t(f.labelKey)}</Text>
            <TextInput
              style={styles.input}
              value={drafts[f.key]}
              onChangeText={(val) => setDrafts((d) => ({ ...d, [f.key]: val }))}
              placeholder={units === 'imperial' ? 'in' : 'cm'}
              placeholderTextColor={colors.text.tertiary}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </View>
        ))}
      </View>

      <Button label={t('common.save')} onPress={handleSave} style={{ marginTop: spacing.base }} />
    </ScrollView>
  );
}

const getStyles = (colors: Colors) =>
  StyleSheet.create({
    screen:  { flex: 1, backgroundColor: colors.bg.primary },
    content: { padding: spacing.base, paddingBottom: spacing.xl },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
    title:  { fontFamily: typography.fonts.display, fontSize: typography.sizes.xl, color: colors.text.primary },

    sectionSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, lineHeight: 20, marginBottom: spacing.base },

    card: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, overflow: 'hidden' },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: spacing.base, paddingHorizontal: spacing.base,
      borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
    },
    rowLabel: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.primary },
    input: {
      fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.primary,
      borderBottomWidth: 1, borderBottomColor: withAlpha(colors.accent.primary, 0.38),
      textAlign: 'center', minWidth: 70, paddingVertical: 2,
    },
  });

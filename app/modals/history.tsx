import { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../stores/userStore';
import { useNutritionStore, type FoodEntry } from '../../stores/nutritionStore';
import { useWeightLogStore } from '../../stores/weightLogStore';
import { useMeasurementLogStore, MEASUREMENT_FIELDS } from '../../stores/measurementLogStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useExerciseWeightStore } from '../../stores/exerciseWeightStore';
import { groupByDate, formatWorkoutDate } from '../../services/workoutHistory';
import { withAlpha, type Colors } from '../../constants/colors';
import { useColors } from '../../constants/useColors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { getElevation } from '../../constants/elevation';
import { useT } from '../../constants/i18n';
import { SparklineChart } from '../../components/ui/SparklineChart';
import {
  Icon, type IconComponent, ArrowLeft, UtensilsCrossed, Scale, Ruler, Dumbbell,
  ChevronDown, ChevronUp, workoutIcon,
} from '../../components/ui/Icon';

type HistoryTab = 'nutrition' | 'weight' | 'measurements' | 'workouts';
const TAB_KEYS: HistoryTab[] = ['nutrition', 'weight', 'measurements', 'workouts'];

function kgToLbs(kg: number) { return Math.round(kg * 2.20462 * 10) / 10; }
function cmToInDecimal(cm: number) { return Math.round((cm / 2.54) * 10) / 10; }

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab = (TAB_KEYS as string[]).includes(params.tab ?? '') ? (params.tab as HistoryTab) : 'nutrition';
  const [tab, setTab] = useState<HistoryTab>(initialTab);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  const profile = useUserStore((s) => s.profile);
  const units = profile?.units ?? 'metric';
  const weightUnit = units === 'imperial' ? 'lbs' : 'kg';
  const measurementUnit = units === 'imperial' ? 'in' : 'cm';

  const nutritionEntries    = useNutritionStore((s) => s.entries);
  const weightEntries       = useWeightLogStore((s) => s.entries);
  const measurementEntries  = useMeasurementLogStore((s) => s.entries);
  const workoutHistory      = useWorkoutStore((s) => s.history);
  const exerciseLogs        = useExerciseWeightStore((s) => s.logs);
  const getExerciseHistory  = useExerciseWeightStore((s) => s.getHistory);

  const TABS: { key: HistoryTab; labelKey: string; icon: IconComponent }[] = [
    { key: 'nutrition',    labelKey: 'history.tabNutrition',    icon: UtensilsCrossed },
    { key: 'weight',       labelKey: 'history.tabWeight',       icon: Scale },
    { key: 'measurements', labelKey: 'history.tabMeasurements', icon: Ruler },
    { key: 'workouts',     labelKey: 'history.tabWorkouts',     icon: Dumbbell },
  ];

  const nutritionByDay = useMemo(() => {
    const map = new Map<string, { date: string; calories: number; protein: number; carbs: number; fat: number; items: FoodEntry[] }>();
    for (const e of nutritionEntries) {
      const row = map.get(e.date) ?? { date: e.date, calories: 0, protein: 0, carbs: 0, fat: 0, items: [] as FoodEntry[] };
      row.calories += e.calories;
      row.protein  += e.protein;
      row.carbs    += e.carbs;
      row.fat      += e.fat;
      row.items.push(e);
      map.set(e.date, row);
    }
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [nutritionEntries]);

  const weightSorted = useMemo(
    () => [...weightEntries].sort((a, b) => a.date.localeCompare(b.date)),
    [weightEntries],
  );
  const weightChartData = weightSorted.map((e) => (units === 'imperial' ? kgToLbs(e.weight_kg) : e.weight_kg));

  const measurementSeries = useMemo(() => MEASUREMENT_FIELDS.map((f) => {
    const points = measurementEntries
      .filter((e) => e[f.key] != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => (units === 'imperial' ? cmToInDecimal(e[f.key] as number) : (e[f.key] as number)));
    return { ...f, points };
  }), [measurementEntries, units]);

  const groupedWorkouts = useMemo(
    () => groupByDate(workoutHistory).sort((a, b) => b.date.localeCompare(a.date)),
    [workoutHistory],
  );

  const exerciseNames = useMemo(
    () => Object.keys(exerciseLogs).filter((n) => exerciseLogs[n].length >= 2),
    [exerciseLogs],
  );
  const exerciseChartData = selectedExercise
    ? [...getExerciseHistory(selectedExercise)].reverse().map((e) => (units === 'imperial' ? kgToLbs(e.weightKg) : e.weightKg))
    : [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Icon icon={ArrowLeft} size="lg" color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('history.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tb) => (
          <TouchableOpacity
            key={tb.key}
            style={[styles.tabPill, tab === tb.key && styles.tabPillActive]}
            onPress={() => setTab(tb.key)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === tb.key }}
            accessibilityLabel={t(tb.labelKey)}
          >
            <Icon icon={tb.icon} size="sm" color={tab === tb.key ? colors.accent.primary : colors.text.tertiary} />
            <Text style={[styles.tabPillText, tab === tb.key && styles.tabPillTextActive]}>{t(tb.labelKey)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Nutrition ── */}
      {tab === 'nutrition' && (
        nutritionByDay.length === 0 ? (
          <EmptyState colors={colors} styles={styles} icon={UtensilsCrossed} title={t('history.nutritionEmpty')} sub={t('history.nutritionEmptySub')} />
        ) : (
          <View style={styles.list}>
            {nutritionByDay.map((day) => {
              const expanded = expandedDate === day.date;
              return (
                <View key={day.date} style={styles.card}>
                  <TouchableOpacity
                    style={styles.dayRow}
                    onPress={() => setExpandedDate(expanded ? null : day.date)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                  >
                    <View>
                      <Text style={styles.dayDate}>{day.date}</Text>
                      <Text style={styles.daySub}>{t('history.macroSummary', { protein: Math.round(day.protein), carbs: Math.round(day.carbs), fat: Math.round(day.fat) })}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Text style={styles.dayCalories}>{Math.round(day.calories)} kcal</Text>
                      <Icon icon={expanded ? ChevronUp : ChevronDown} size="sm" color={colors.text.tertiary} />
                    </View>
                  </TouchableOpacity>
                  {expanded && (
                    <View style={styles.itemList}>
                      {day.items.map((it) => (
                        <View key={it.id} style={styles.itemRow}>
                          <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                          <Text style={styles.itemCals}>{it.calories} kcal</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )
      )}

      {/* ── Weight ── */}
      {tab === 'weight' && (
        weightSorted.length === 0 ? (
          <EmptyState colors={colors} styles={styles} icon={Scale} title={t('history.weightEmpty')} sub={t('history.weightEmptySub')} />
        ) : (
          <View style={styles.card}>
            {weightChartData.length >= 2 ? (
              <SparklineChart data={weightChartData} color={colors.accent.primary} width={300} />
            ) : (
              <Text style={styles.placeholderText}>{t('history.needMoreData')}</Text>
            )}
            <View style={styles.list}>
              {[...weightSorted].reverse().map((e) => (
                <View key={e.date} style={styles.itemRow}>
                  <Text style={styles.itemName}>{e.date}</Text>
                  <Text style={styles.itemCals}>{units === 'imperial' ? kgToLbs(e.weight_kg) : e.weight_kg} {weightUnit}</Text>
                </View>
              ))}
            </View>
          </View>
        )
      )}

      {/* ── Measurements ── */}
      {tab === 'measurements' && (
        <View style={styles.list}>
          {measurementSeries.map((s) => (
            <View key={s.key} style={styles.card}>
              <Text style={styles.cardTitle}>{t(s.labelKey)}</Text>
              {s.points.length >= 2 ? (
                <SparklineChart data={s.points} color={colors.accent.primary} width={300} />
              ) : (
                <Text style={styles.placeholderText}>{t('history.needMoreData')}</Text>
              )}
              {s.points.length > 0 && (
                <Text style={styles.daySub}>{t('history.latestValue', { value: s.points[s.points.length - 1], unit: measurementUnit })}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* ── Workouts ── */}
      {tab === 'workouts' && (
        groupedWorkouts.length === 0 ? (
          <EmptyState colors={colors} styles={styles} icon={Dumbbell} title={t('history.workoutsEmpty')} sub={t('history.workoutsEmptySub')} />
        ) : (
          <>
            {exerciseNames.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('history.exerciseProgress')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
                  {exerciseNames.map((name) => (
                    <TouchableOpacity
                      key={name}
                      style={[styles.exerciseChip, selectedExercise === name && styles.exerciseChipActive]}
                      onPress={() => setSelectedExercise(selectedExercise === name ? null : name)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.exerciseChipText, selectedExercise === name && styles.exerciseChipTextActive]} numberOfLines={1}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {selectedExercise && (
                  exerciseChartData.length >= 2 ? (
                    <SparklineChart data={exerciseChartData} color={colors.accent.primary} width={300} />
                  ) : (
                    <Text style={styles.placeholderText}>{t('history.needMoreData')}</Text>
                  )
                )}
              </View>
            )}
            <View style={styles.list}>
              {groupedWorkouts.map((w) => {
                const weightEntriesList = Object.entries(w.exerciseWeights ?? {}).filter(([, kg]) => kg > 0);
                return (
                  <View key={w.id} style={styles.recentRow}>
                    <View style={styles.recentIcon}><Icon icon={workoutIcon(w.icon)} size="md" color={colors.accent.primary} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dayDate}>{w.name}</Text>
                      <Text style={styles.daySub}>{formatWorkoutDate(w.date)} ({w.date})  ·  {w.duration}  ·  {w.exercisesDone}/{w.exercisesTotal}</Text>
                      {weightEntriesList.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {weightEntriesList.map(([name, kg]) => (
                            <View key={name} style={styles.exerciseChip}>
                              <Text style={styles.exerciseChipText}>{name.split(' ')[0]} {units === 'imperial' ? kgToLbs(kg) : kg}{weightUnit}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    <Text style={styles.dayCalories}>{w.calories} kcal</Text>
                  </View>
                );
              })}
            </View>
          </>
        )
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

function EmptyState({ colors, styles, icon, title, sub }: { colors: Colors; styles: ReturnType<typeof getStyles>; icon: IconComponent; title: string; sub: string }) {
  return (
    <View style={styles.emptyState}>
      <Icon icon={icon} size={36} color={colors.text.tertiary} strokeWidth={1.5} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const getStyles = (colors: Colors) => {
  const elevation = getElevation(colors);
  return StyleSheet.create({
    screen:  { flex: 1, backgroundColor: colors.bg.primary },
    content: { padding: spacing.base, paddingBottom: spacing.xl },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.base },
    title:  { fontFamily: typography.fonts.display, fontSize: typography.sizes.xl, color: colors.text.primary },

    tabRow: { flexDirection: 'row', backgroundColor: colors.bg.elevated, borderRadius: radius.full, padding: 3, marginBottom: spacing.base },
    tabPill: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.sm, borderRadius: radius.full },
    tabPillActive: { backgroundColor: colors.bg.secondary, ...elevation.card },
    tabPillText: { fontFamily: typography.fonts.body, fontSize: 10, color: colors.text.tertiary },
    tabPillTextActive: { color: colors.accent.primary, fontFamily: typography.fonts.bodyMed },

    list: { gap: spacing.sm },
    card: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.base, gap: spacing.sm },
    cardTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },

    dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dayDate: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.primary },
    daySub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
    dayCalories: { fontFamily: typography.fonts.mono, fontSize: typography.sizes.sm, color: colors.text.secondary },

    itemList: { marginTop: spacing.sm, gap: 6, borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingTop: spacing.sm },
    itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    itemName: { flex: 1, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginRight: spacing.sm },
    itemCals: { fontFamily: typography.fonts.mono, fontSize: typography.sizes.sm, color: colors.text.primary },

    placeholderText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary, fontStyle: 'italic' },

    recentRow: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.base, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    recentIcon: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: withAlpha(colors.accent.primary, 0.13), alignItems: 'center', justifyContent: 'center' },

    exerciseChip: { backgroundColor: colors.bg.elevated, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
    exerciseChipActive: { backgroundColor: withAlpha(colors.accent.primary, 0.13) },
    exerciseChipText: { fontFamily: typography.fonts.body, fontSize: 11, color: colors.text.secondary },
    exerciseChipTextActive: { color: colors.accent.primary, fontFamily: typography.fonts.bodyMed },

    emptyState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
    emptyTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
    emptySub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary, textAlign: 'center' },
  });
};

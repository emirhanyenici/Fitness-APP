import { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useNutritionStore, FoodEntry } from '../../stores/nutritionStore';
import { useAISuggestionsStore } from '../../stores/aiSuggestionsStore';
import { useUserStore } from '../../stores/userStore';
import { computeTargets } from '../../services/recommendations';
import { todayStr } from '../../services/dateUtils';
import { colors, withAlpha } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { elevation } from '../../constants/elevation';
import { useAnalytics } from '../../services/analytics';
import { AICoachBanner } from '../../components/ui/AICoachBanner';
import { useT } from '../../constants/i18n';
import {
  Icon, Coffee, Sun, UtensilsCrossed, Cookie, Droplets, X, ChevronDown, ChevronUp,
} from '../../components/ui/Icon';

const MEAL_META = [
  { id: 'breakfast', labelKey: 'nutrition.breakfast', icon: Coffee },
  { id: 'lunch',     labelKey: 'nutrition.lunch',     icon: Sun },
  { id: 'dinner',    labelKey: 'nutrition.dinner',    icon: UtensilsCrossed },
  { id: 'snack',     labelKey: 'nutrition.snacks',    icon: Cookie },
];

export default function NutritionScreen() {
  const [expanded, setExpanded] = useState<string | null>('breakfast');

  const allEntries   = useNutritionStore((s) => s.entries);
  const removeEntry  = useNutritionStore((s) => s.removeEntry);
  const waterByDate  = useNutritionStore((s) => s.waterByDate);
  const setWater     = useNutritionStore((s) => s.setWater);
  const aiNutrition  = useAISuggestionsStore((s) => s.nutrition);
  const clearAI      = useAISuggestionsStore((s) => s.clear);
  const profile      = useUserStore((s) => s.profile);
  const analytics    = useAnalytics();
  const t            = useT();

  const targets       = useMemo(() => computeTargets(profile), [profile]);
  const GOAL_CALS     = targets.calories;
  const MACRO_TARGETS = { protein: targets.protein, carbs: targets.carbs, fat: targets.fat };

  // Compute today fresh each render — prevents stale date after midnight
  const today = todayStr();
  const water = waterByDate[today] ?? 0;
  const todayAISuggestion = aiNutrition?.date === today ? aiNutrition : null;

  const todayEntries = useMemo(
    () => allEntries.filter((e) => e.date === today),
    [allEntries, today],
  );

  const mealEntries = useMemo(() => {
    const map: Record<string, FoodEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    for (const e of todayEntries) map[e.mealType]?.push(e);
    return map;
  }, [todayEntries]);

  const totalCals    = useMemo(() => todayEntries.reduce((s, e) => s + e.calories, 0), [todayEntries]);
  const totalProtein = useMemo(() => todayEntries.reduce((s, e) => s + e.protein,  0), [todayEntries]);
  const totalCarbs   = useMemo(() => todayEntries.reduce((s, e) => s + e.carbs,    0), [todayEntries]);
  const totalFat     = useMemo(() => todayEntries.reduce((s, e) => s + e.fat,      0), [todayEntries]);

  const pct = Math.min(totalCals / GOAL_CALS, 1);

  const macros = [
    { label: 'Protein', short: 'P', current: totalProtein, target: MACRO_TARGETS.protein, color: colors.status.info },
    { label: 'Carbs',   short: 'C', current: totalCarbs,   target: MACRO_TARGETS.carbs,   color: colors.status.warning },
    { label: 'Fat',     short: 'F', current: totalFat,     target: MACRO_TARGETS.fat,     color: colors.violet.primary },
  ];

  const handleDeleteFood = (item: FoodEntry) => {
    Alert.alert(
      t('nutrition.removeFood'),
      t('nutrition.removeFoodConfirm', { name: item.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('nutrition.remove'), style: 'destructive', onPress: () => removeEntry(item.id) },
      ],
    );
  };

  const handleWaterTap = () => {
    const next = Math.min(water + 1, targets.waterGlasses);
    setWater(next);
    analytics.waterUpdated(next);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>{t('nutrition.title')}</Text>
          <Text style={styles.pageSub}>{t('nutrition.todaysIntake')}</Text>
        </View>
      </View>

      {/* ── Calorie Summary Card ── */}
      <View style={styles.calorieCard}>
        <View style={styles.calorieLeft}>
          <Text style={styles.calsNum}>{totalCals.toLocaleString()}</Text>
          <Text style={styles.calsSub}>/ {GOAL_CALS.toLocaleString()} kcal</Text>
          <View style={styles.calBarBg}>
            <View style={[styles.calBarFill, { width: `${Math.round(pct * 100)}%` as any }]} />
          </View>
          <Text style={styles.calsRemain}>
            {totalCals >= GOAL_CALS
              ? t('nutrition.kcalOver', { n: totalCals - GOAL_CALS })
              : t('nutrition.kcalRemaining', { n: GOAL_CALS - totalCals })}
          </Text>
        </View>

        <View style={styles.macroCol}>
          {macros.map((m) => (
            <View key={m.label} style={styles.macroItem}>
              <View style={styles.macroBarBg}>
                <View style={[styles.macroBarFill, { width: `${Math.min(m.current / m.target, 1) * 100}%` as any, backgroundColor: m.color }]} />
              </View>
              {/* Round to 1 decimal for display — summed 0.1g-precision floats
                  accumulate FP noise like 10.799999999999999 (finding F11) */}
              <Text style={[styles.macroLabel, { color: m.color }]}>{m.short}  {Math.round(m.current * 10) / 10}g</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Water Tracker ── */}
      <View style={styles.waterCard}>
        <View style={styles.waterCardTop}>
          <View>
            <Text style={styles.waterTitle}>{t('nutrition.waterIntake')}</Text>
            <Text style={styles.waterMl}>{water * 250} / {targets.waterGlasses * 250} ml</Text>
          </View>
          <View style={styles.waterControls}>
            <TouchableOpacity
              style={styles.waterCtrlBtn}
              onPress={() => { const n = Math.max(water - 1, 0); setWater(n); analytics.waterUpdated(n); }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('nutrition.removeWaterGlass')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.waterCtrlText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.waterCountText}>{water} / {targets.waterGlasses}</Text>
            <TouchableOpacity
              style={styles.waterCtrlBtn}
              onPress={handleWaterTap}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('nutrition.addWaterGlass')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.waterCtrlText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.waterDropRow}>
          {Array.from({ length: targets.waterGlasses }).map((_, i) => {
            const filled = i < water;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.waterCircle, filled && styles.waterCircleFilled]}
                onPress={() => {
                  // tap filled = decrement to i, tap empty = fill to i+1
                  const n = filled && i === water - 1 ? i : i + 1;
                  setWater(n); analytics.waterUpdated(n);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('nutrition.glassOf', { i: i + 1, total: targets.waterGlasses, state: filled ? t('nutrition.filled') : t('nutrition.empty') })}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                {filled && <Icon icon={Droplets} size="sm" color={colors.bg.secondary} strokeWidth={2} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.waterBarBg}>
          <View style={[styles.waterBarFill, { width: `${Math.min(water / targets.waterGlasses, 1) * 100}%` as any }]} />
        </View>

        <Text style={styles.waterHint}>{t('nutrition.waterHint', { glasses: targets.waterGlasses, liters: targets.waterGlasses * 250 / 1000 })}</Text>
      </View>

      {/* ── AI Coach Banner ── */}
      <AICoachBanner subtitle={t('nutrition.aiCoachSubtitle')} />

      {/* ── AI Meal Suggestion ── */}
      {todayAISuggestion && (
        <View style={styles.aiCard}>
          <View style={styles.aiCardHeader}>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>{t('nutrition.dailyMealSuggestions')}</Text>
            </View>
            <TouchableOpacity
              onPress={() => clearAI('nutrition')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('nutrition.dismissSuggestion')}
            >
              <Icon icon={X} size="sm" color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.aiText}>{todayAISuggestion.text}</Text>
          <TouchableOpacity
            style={styles.aiCoachBtn}
            onPress={() => router.push('/modals/ai-coach')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('nutrition.askAiMoreA11y')}
          >
            <Text style={styles.aiCoachBtnText}>{t('nutrition.askAiMore')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Meal Sections ── */}
      {MEAL_META.map((meal) => {
        const items  = mealEntries[meal.id] ?? [];
        const mCals  = items.reduce((s, e) => s + e.calories, 0);
        const isOpen = expanded === meal.id;
        const mealLabel = t(meal.labelKey);

        return (
          <View key={meal.id} style={styles.mealCard}>
            <TouchableOpacity
              style={styles.mealHeader}
              onPress={() => setExpanded(isOpen ? null : meal.id)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={t('nutrition.mealSummary', { meal: mealLabel, info: mCals > 0 ? t('nutrition.kilocalories', { n: mCals }) : t('nutrition.nothingLogged') })}
            >
              <View style={styles.mealLeft}>
                <Icon icon={meal.icon} size="md" color={colors.accent.primary} />
                <View>
                  <Text style={styles.mealTitle}>{mealLabel}</Text>
                  <Text style={styles.mealCals}>
                    {mCals > 0 ? `${mCals} kcal` : t('nutrition.nothingLogged')}
                  </Text>
                </View>
              </View>
              <View style={styles.mealRight}>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => router.push({ pathname: '/modals/add-food', params: { mealType: meal.id } })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('nutrition.addFoodTo', { meal: mealLabel })}
                >
                  <Text style={styles.addBtnText}>{t('nutrition.add')}</Text>
                </TouchableOpacity>
                <Icon icon={isOpen ? ChevronUp : ChevronDown} size="md" color={colors.text.tertiary} />
              </View>
            </TouchableOpacity>

            {isOpen && (
              <View style={styles.mealItems}>
                {items.length > 0 ? (
                  items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.foodRow}
                      onPress={() => handleDeleteFood(item)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={t('nutrition.removeFoodA11y', { name: item.name, calories: item.calories })}
                    >
                      <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.foodRight}>
                        <Text style={styles.foodCals}>{item.calories} kcal</Text>
                        <Icon icon={X} size="sm" color={colors.text.tertiary} />
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.emptyText}>{t('nutrition.tapAddToLog')}</Text>
                )}
              </View>
            )}
          </View>
        );
      })}

      <Text style={styles.hint}>{t('nutrition.tapToRemove')}</Text>
      <View style={{ height: 110 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.base },

  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 52, marginBottom: spacing.xl },
  pageTitle: { fontFamily: typography.fonts.display, fontSize: typography.sizes['2xl'], color: colors.text.primary },
  pageSub:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: 2 },

  waterCard:     { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: withAlpha(colors.status.info, 0.19), borderRadius: radius.xl, padding: spacing.base, marginBottom: spacing.base, gap: spacing.sm, ...elevation.card },
  waterCardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  waterTitle:    { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  waterMl:       { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.status.info, marginTop: 2 },
  waterControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  waterCtrlBtn:  { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: withAlpha(colors.status.info, 0.25), alignItems: 'center', justifyContent: 'center' },
  waterCtrlText: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.status.info },
  waterCountText:{ fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.primary, minWidth: 36, textAlign: 'center' },
  waterDropRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
  waterCircle:     { flex: 1, height: 32, borderRadius: radius.sm, borderWidth: 1.5, borderColor: withAlpha(colors.status.info, 0.25), backgroundColor: colors.bg.elevated, marginHorizontal: 2, alignItems: 'center', justifyContent: 'center' },
  waterCircleFilled: { backgroundColor: withAlpha(colors.status.info, 0.13), borderColor: colors.status.info },
  waterBarBg:    { width: '100%', height: 4, backgroundColor: colors.bg.elevated, borderRadius: 2, overflow: 'hidden' },
  waterBarFill:  { height: '100%', backgroundColor: colors.status.info, borderRadius: 2 },
  waterHint:     { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, textAlign: 'center' },

  calorieCard:  { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.13), borderRadius: radius['2xl'], padding: spacing.base, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base, gap: spacing.base, ...elevation.raised },
  calorieLeft:  { flex: 1 },
  calsNum:      { fontFamily: typography.fonts.mono, fontSize: typography.sizes['3xl'], color: colors.text.primary },
  calsSub:      { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginBottom: spacing.sm },
  calBarBg:     { width: '100%', height: 5, backgroundColor: colors.bg.elevated, borderRadius: 3, overflow: 'hidden', marginBottom: spacing.xs },
  calBarFill:   { height: '100%', backgroundColor: colors.accent.primary, borderRadius: 3 },
  calsRemain:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },

  macroCol:     { gap: spacing.sm, width: 100 },
  macroItem:    { gap: 4 },
  macroBarBg:   { width: '100%', height: 4, backgroundColor: colors.bg.elevated, borderRadius: 2, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: 2 },
  macroLabel:   { fontFamily: typography.fonts.mono, fontSize: typography.sizes.xs },

  aiCard:        { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.19), borderRadius: radius.xl, padding: spacing.base, marginBottom: spacing.base, ...elevation.card },
  aiCardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  aiBadge:       { backgroundColor: colors.accent.dim, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  aiBadgeText:   { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },
  aiText:        { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.primary, lineHeight: 20, marginBottom: spacing.base },
  aiCoachBtn:    { alignSelf: 'flex-end', backgroundColor: colors.accent.dim, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.3), borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7 },
  aiCoachBtnText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },

  mealCard:   { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, marginBottom: spacing.sm, overflow: 'hidden', ...elevation.card },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.base },
  mealLeft:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mealTitle:  { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  mealCals:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
  mealRight:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addBtn:     { borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.38), borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  addBtnText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },

  mealItems:  { borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingHorizontal: spacing.base, paddingBottom: spacing.base },
  foodRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  foodName:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.primary, flex: 1, marginRight: spacing.sm },
  foodRight:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  foodCals:   { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.secondary },
  emptyText:  { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary, textAlign: 'center', paddingTop: spacing.base },

  hint: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.xs },
});

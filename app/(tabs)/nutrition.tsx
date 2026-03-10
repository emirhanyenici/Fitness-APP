import { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useNutritionStore, FoodEntry } from '../../stores/nutritionStore';
import { useAISuggestionsStore } from '../../stores/aiSuggestionsStore';
import { useUserStore } from '../../stores/userStore';
import { computeTargets } from '../../services/recommendations';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { useAnalytics } from '../../services/analytics';
import { AICoachBanner } from '../../components/ui/AICoachBanner';

const MEAL_META = [
  { id: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { id: 'lunch',     label: 'Lunch',     icon: '☀️'  },
  { id: 'dinner',    label: 'Dinner',    icon: '🌙'  },
  { id: 'snack',     label: 'Snacks',    icon: '🍎'  },
];

export default function NutritionScreen() {
  const [expanded, setExpanded] = useState<string | null>('breakfast');

  const allEntries  = useNutritionStore((s) => s.entries);
  const removeEntry = useNutritionStore((s) => s.removeEntry);
  const water       = useNutritionStore((s) => s.waterGlasses);
  const setWater    = useNutritionStore((s) => s.setWater);
  const aiNutrition = useAISuggestionsStore((s) => s.nutrition);
  const clearAI     = useAISuggestionsStore((s) => s.clear);
  const profile     = useUserStore((s) => s.profile);
  const analytics   = useAnalytics();

  const targets       = useMemo(() => computeTargets(profile), [profile]);
  const GOAL_CALS     = targets.calories;
  const MACRO_TARGETS = { protein: targets.protein, carbs: targets.carbs, fat: targets.fat };

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
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
      'Remove Food',
      `Remove "${item.name}" from your log?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeEntry(item.id) },
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
          <Text style={styles.pageTitle}>Nutrition</Text>
          <Text style={styles.pageSub}>Today's intake</Text>
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
              ? `${totalCals - GOAL_CALS} kcal over goal`
              : `${GOAL_CALS - totalCals} kcal remaining`}
          </Text>
        </View>

        <View style={styles.macroCol}>
          {macros.map((m) => (
            <View key={m.label} style={styles.macroItem}>
              <View style={styles.macroBarBg}>
                <View style={[styles.macroBarFill, { width: `${Math.min(m.current / m.target, 1) * 100}%` as any, backgroundColor: m.color }]} />
              </View>
              <Text style={[styles.macroLabel, { color: m.color }]}>{m.short}  {m.current}g</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Water Tracker ── */}
      <View style={styles.waterCard}>
        <View style={styles.waterCardTop}>
          <View>
            <Text style={styles.waterTitle}>💧 Water Intake</Text>
            <Text style={styles.waterMl}>{water * 250} / {targets.waterGlasses * 250} ml</Text>
          </View>
          <View style={styles.waterControls}>
            <TouchableOpacity
              style={styles.waterCtrlBtn}
              onPress={() => { const n = Math.max(water - 1, 0); setWater(n); analytics.waterUpdated(n); }}
              activeOpacity={0.7}
            >
              <Text style={styles.waterCtrlText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.waterCountText}>{water} / {targets.waterGlasses}</Text>
            <TouchableOpacity style={styles.waterCtrlBtn} onPress={handleWaterTap} activeOpacity={0.7}>
              <Text style={styles.waterCtrlText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.waterDropRow}>
          {Array.from({ length: targets.waterGlasses }).map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => { const n = i + 1; setWater(n); analytics.waterUpdated(n); }}
              activeOpacity={0.6}
            >
              <Text style={{ fontSize: 24, opacity: i < water ? 1 : 0.2 }}>💧</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.waterBarBg}>
          <View style={[styles.waterBarFill, { width: `${Math.min(water / targets.waterGlasses, 1) * 100}%` as any }]} />
        </View>

        <Text style={styles.waterHint}>Each glass = 250 ml · Goal: {targets.waterGlasses} glasses ({targets.waterGlasses * 250 / 1000}L)</Text>
      </View>

      {/* ── AI Coach Banner ── */}
      <AICoachBanner subtitle="Get meal ideas & nutrition advice" />

      {/* ── AI Meal Suggestion ── */}
      {todayAISuggestion && (
        <View style={styles.aiCard}>
          <View style={styles.aiCardHeader}>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>✦ Daily Meal Suggestions</Text>
            </View>
            <TouchableOpacity onPress={() => clearAI('nutrition')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.aiClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.aiText}>{todayAISuggestion.text}</Text>
          <TouchableOpacity
            style={styles.aiCoachBtn}
            onPress={() => router.push('/modals/ai-coach' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.aiCoachBtnText}>Ask AI Coach for more →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Meal Sections ── */}
      {MEAL_META.map((meal) => {
        const items  = mealEntries[meal.id] ?? [];
        const mCals  = items.reduce((s, e) => s + e.calories, 0);
        const isOpen = expanded === meal.id;

        return (
          <View key={meal.id} style={styles.mealCard}>
            <TouchableOpacity
              style={styles.mealHeader}
              onPress={() => setExpanded(isOpen ? null : meal.id)}
              activeOpacity={0.75}
            >
              <View style={styles.mealLeft}>
                <Text style={{ fontSize: 20 }}>{meal.icon}</Text>
                <View>
                  <Text style={styles.mealTitle}>{meal.label}</Text>
                  <Text style={styles.mealCals}>
                    {mCals > 0 ? `${mCals} kcal` : 'Nothing logged'}
                  </Text>
                </View>
              </View>
              <View style={styles.mealRight}>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => router.push({ pathname: '/modals/add-food', params: { mealType: meal.id } })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.addBtnText}>+ Add</Text>
                </TouchableOpacity>
                <Text style={styles.chevron}>{isOpen ? '∧' : '∨'}</Text>
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
                    >
                      <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.foodRight}>
                        <Text style={styles.foodCals}>{item.calories} kcal</Text>
                        <Text style={styles.foodDelete}>✕</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.emptyText}>Tap + Add to log food</Text>
                )}
              </View>
            )}
          </View>
        );
      })}

      <Text style={styles.hint}>Tap a food item to remove it</Text>
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

  waterCard:     { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.status.info + '30', borderRadius: radius['2xl'], padding: spacing.base, marginBottom: spacing.base, gap: spacing.sm },
  waterCardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  waterTitle:    { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  waterMl:       { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.status.info, marginTop: 2 },
  waterControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  waterCtrlBtn:  { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.status.info + '40', alignItems: 'center', justifyContent: 'center' },
  waterCtrlText: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.status.info },
  waterCountText:{ fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.primary, minWidth: 36, textAlign: 'center' },
  waterDropRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
  waterBarBg:    { width: '100%', height: 4, backgroundColor: colors.bg.elevated, borderRadius: 2, overflow: 'hidden' },
  waterBarFill:  { height: '100%', backgroundColor: colors.status.info, borderRadius: 2 },
  waterHint:     { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, textAlign: 'center' },

  calorieCard:  { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.accent.primary + '20', borderRadius: radius['2xl'], padding: spacing.base, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base, gap: spacing.base },
  calorieLeft:  { flex: 1 },
  calsNum:      { fontFamily: typography.fonts.display, fontSize: typography.sizes['3xl'], color: colors.text.primary },
  calsSub:      { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginBottom: spacing.sm },
  calBarBg:     { width: '100%', height: 5, backgroundColor: colors.bg.elevated, borderRadius: 3, overflow: 'hidden', marginBottom: spacing.xs },
  calBarFill:   { height: '100%', backgroundColor: colors.accent.primary, borderRadius: 3 },
  calsRemain:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },

  macroCol:     { gap: spacing.sm, width: 100 },
  macroItem:    { gap: 4 },
  macroBarBg:   { width: '100%', height: 4, backgroundColor: colors.bg.elevated, borderRadius: 2, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: 2 },
  macroLabel:   { fontFamily: typography.fonts.mono, fontSize: typography.sizes.xs },

  aiCard:        { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.accent.primary + '30', borderRadius: radius.xl, padding: spacing.base, marginBottom: spacing.base },
  aiCardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  aiBadge:       { backgroundColor: colors.accent.dim, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  aiBadgeText:   { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },
  aiClose:       { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary },
  aiText:        { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.primary, lineHeight: 20, marginBottom: spacing.base },
  aiCoachBtn:    { alignSelf: 'flex-end', backgroundColor: colors.accent.dim, borderWidth: 1, borderColor: colors.accent.primary + '50', borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7 },
  aiCoachBtnText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },

  mealCard:   { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, marginBottom: spacing.sm, overflow: 'hidden' },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.base },
  mealLeft:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mealTitle:  { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  mealCals:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
  mealRight:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addBtn:     { borderWidth: 1, borderColor: colors.accent.primary + '60', borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  addBtnText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },
  chevron:    { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary, width: 16, textAlign: 'center' },

  mealItems:  { borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingHorizontal: spacing.base, paddingBottom: spacing.base },
  foodRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  foodName:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.primary, flex: 1, marginRight: spacing.sm },
  foodRight:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  foodCals:   { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.secondary },
  foodDelete: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, paddingLeft: 4 },
  emptyText:  { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary, textAlign: 'center', paddingTop: spacing.base },

  hint: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.xs },
});

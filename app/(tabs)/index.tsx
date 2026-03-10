import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { useUserStore } from '../../stores/userStore';
import { useNutritionStore } from '../../stores/nutritionStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { GOAL_TO_BODY_PART, TYPE_TO_BODY_PART, BODY_PART_LABEL } from '../../services/exercisedb';
import { computeTargets, GOAL_LABELS } from '../../services/recommendations';
import { useNovraScore } from '../../hooks/useNovraScore';
import { AICoachBanner } from '../../components/ui/AICoachBanner';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}

export default function HomeScreen() {
  const isPro           = useSubscriptionStore((s) => s.isPro);
  const profile         = useUserStore((s) => s.profile);
  const entries         = useNutritionStore((s) => s.entries);
  const selectedType    = useWorkoutStore((s) => s.selectedType);
  const recoveryEntries = useRecoveryStore((s) => s.entries);

  const todayDate = useMemo(() => new Date(), []);
  const todayStr  = useMemo(() => todayDate.toISOString().slice(0, 10), [todayDate]);
  const today     = todayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const targets    = useMemo(() => computeTargets(profile), [profile]);
  const { score, scoreColor, pillars, deltaLabel, deltaColor, todayCalories, calPct } = useNovraScore();

  const proteinLeft = useMemo(() => {
    const todayProtein = entries
      .filter((e) => e.date === todayStr)
      .reduce((s, e) => s + e.protein, 0);
    return Math.max(0, targets.protein - todayProtein);
  }, [entries, todayStr, targets.protein]);

  // ── Streak (starts from yesterday if today has no data yet) ──
  const activeDates = useMemo(() => new Set([
    ...entries.map((e) => e.date),
    ...recoveryEntries.map((e) => e.date),
  ]), [entries, recoveryEntries]);

  const streak = useMemo(() => {
    const startFrom = activeDates.has(todayStr) ? 0 : 1;
    let count = 0;
    for (let i = startFrom; i <= 365; i++) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      if (activeDates.has(d)) { count++; } else { break; }
    }
    return count;
  }, [activeDates, todayStr]);

  // ── Current week Mon→Sun ──
  const weekDates = useMemo(() => {
    const mondayOffset = todayDate.getDay() === 0 ? -6 : 1 - todayDate.getDay();
    return Array.from({ length: 7 }, (_, i) =>
      new Date(todayDate.getTime() + (mondayOffset + i) * 86_400_000).toISOString().slice(0, 10)
    );
  }, [todayDate]);

  // ── Workout meta ──
  const primaryGoal = profile?.primary_goal ?? 'general_health';
  const bodyPart    = selectedType
    ? (TYPE_TO_BODY_PART[selectedType] ?? GOAL_TO_BODY_PART[primaryGoal] ?? 'chest')
    : (GOAL_TO_BODY_PART[primaryGoal] ?? 'chest');
  const isRestDay   = selectedType === 'rest';
  const workoutMeta = BODY_PART_LABEL[bodyPart] ?? { name: 'Custom Workout', duration: '30 min', intensity: 'Moderate' };

  const stats = [
    { icon: '👟', value: '0',                                          label: 'Steps',   color: colors.accent.primary, pct: 0 },
    { icon: '🔥', value: todayCalories > 0 ? `${todayCalories}` : '0', label: 'Calories', color: colors.status.warning, pct: calPct },
    { icon: '💤', value: '0h',                                         label: 'Sleep',   color: colors.violet.primary, pct: 0 },
    { icon: '⚡', value: '0m',                                         label: 'Active',  color: colors.status.success, pct: 0 },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.name}>{profile?.name ?? 'Novra User'}</Text>
        </View>
        <TouchableOpacity style={styles.dateChip} onPress={() => router.push('/(tabs)/profile')}>
          <Text style={styles.dateText}>{today}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Novra Score Hero ── */}
      <View style={styles.heroCard}>
        <View style={[styles.ring, { borderColor: scoreColor, shadowColor: scoreColor }]}>
          <Text style={[styles.scoreNum, { color: scoreColor }]}>{score}</Text>
          <Text style={styles.scoreLabel}>NOVRA SCORE</Text>
        </View>
        <Text style={[styles.delta, { color: deltaColor }]}>vs yesterday  {deltaLabel}</Text>

        <View style={styles.pillsRow}>
          {pillars.map((p) => (
            <Pressable
              key={p.label}
              style={({ pressed }) => [styles.pill, { borderColor: p.color + '50', opacity: pressed ? 0.7 : 1 }]}
              onPress={() => !isPro && router.push('/paywall')}
            >
              <View style={[styles.pillDot, { backgroundColor: p.color }]} />
              <Text style={styles.pillLabel}>{p.label}</Text>
              <Text style={[styles.pillScore, { color: p.color }]}>{p.value}/25</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Daily Targets ── */}
      <View style={styles.targetsCard}>
        <Text style={styles.targetsGoalLabel}>
          🎯  {GOAL_LABELS[primaryGoal] ?? 'Healthy Lifestyle'}
        </Text>
        <View style={styles.targetsRow}>
          <View style={styles.targetChip}>
            <Text style={styles.targetVal}>{targets.calories.toLocaleString()}</Text>
            <Text style={styles.targetLbl}>kcal</Text>
          </View>
          <View style={styles.targetDiv} />
          <View style={styles.targetChip}>
            <Text style={styles.targetVal}>{targets.protein}g</Text>
            <Text style={styles.targetLbl}>protein</Text>
          </View>
          <View style={styles.targetDiv} />
          <View style={styles.targetChip}>
            <Text style={styles.targetVal}>{targets.sleepHours}h</Text>
            <Text style={styles.targetLbl}>sleep</Text>
          </View>
          <View style={styles.targetDiv} />
          <View style={styles.targetChip}>
            <Text style={styles.targetVal}>{targets.workoutMinutes}m</Text>
            <Text style={styles.targetLbl}>workout</Text>
          </View>
        </View>
      </View>

      {/* ── Daily AI Plan ── */}
      <View style={styles.planCard}>
        <View style={styles.planHeader}>
          <View>
            <Text style={styles.planTitle}>✦  Today's Plan</Text>
            <Text style={styles.planTime}>Generated {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</Text>
          </View>
          <View style={isPro ? styles.proBadge : styles.freeBadge}>
            <Text style={isPro ? styles.proBadgeText : styles.freeBadgeText}>{isPro ? 'PRO' : 'FREE'}</Text>
          </View>
        </View>

        <View style={styles.planRows}>
          <TouchableOpacity style={styles.planRow} onPress={() => router.push('/(tabs)/workout')} activeOpacity={0.7}>
            <Text style={{ fontSize: 18 }}>🏋️</Text>
            <Text style={[styles.planRowText, { flex: 1 }]}>
              {isRestDay ? 'Rest Day — Recovery & light stretching' : `${workoutMeta.name} — ${workoutMeta.duration} · ${workoutMeta.intensity}`}
            </Text>
            <Text style={{ color: colors.text.tertiary, fontSize: 18 }}>›</Text>
          </TouchableOpacity>

          {isPro ? (
            <>
              <View style={styles.planRow}>
                <Text style={{ fontSize: 18 }}>🥗</Text>
                <Text style={styles.planRowText}>
                  {proteinLeft > 0 ? `Protein: +${proteinLeft}g still needed today.` : 'Protein goal reached! Great work.'}
                </Text>
              </View>
              <View style={styles.planRow}>
                <Text style={{ fontSize: 18 }}>🌙</Text>
                <Text style={styles.planRowText}>
                  Sleep {targets.sleepHours}h tonight — screens off by {targets.sleepHours >= 9 ? '9:30 PM' : targets.sleepHours >= 8.5 ? '10:00 PM' : '10:30 PM'}
                </Text>
              </View>
              <View style={styles.planRow}>
                <Text style={{ fontSize: 18 }}>💬</Text>
                <Text style={styles.planRowText}>Stay consistent — small daily wins add up.</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.planRow}>
                <Text style={{ fontSize: 18 }}>🥗</Text>
                <View style={styles.blurBar} />
              </View>
              <View style={styles.planRow}>
                <Text style={{ fontSize: 18 }}>🌙</Text>
                <View style={styles.blurBar} />
              </View>
              <TouchableOpacity style={styles.unlockBtn} onPress={() => router.push('/paywall')} activeOpacity={0.85}>
                <Text style={styles.unlockText}>Unlock Full Plan →</Text>
                <Text style={styles.unlockSub}>See nutrition targets, sleep tips & daily motivation</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* ── Quick Log ── */}
      <Text style={styles.sectionTitle}>Quick Log</Text>
      <View style={styles.quickRow}>
        {[
          { icon: '🍎', label: 'Food',    route: '/modals/add-food' },
          { icon: '💪', label: 'Workout', route: '/modals/log-workout' },
          { icon: '😴', label: 'Sleep',   route: '/(tabs)/recovery' },
          { icon: '😊', label: 'Mood',    route: '/(tabs)/recovery' },
        ].map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.quickBtn}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.75}
          >
            <Text style={{ fontSize: 24 }}>{item.icon}</Text>
            <Text style={styles.quickLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Stats ── */}
      <Text style={styles.sectionTitle}>Today's Stats</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.base }}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Text style={{ fontSize: 22 }}>{s.icon}</Text>
            <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
            <View style={styles.statBarBg}>
              <View style={[styles.statBarFill, { width: `${s.pct * 100}%` as any, backgroundColor: s.color }]} />
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ── AI Coach Banner ── */}
      <AICoachBanner subtitle="Ask about workouts, nutrition & recovery" />

      {/* ── Streak ── */}
      <View style={styles.streakCard}>
        <View style={styles.streakLeft}>
          <Text style={{ fontSize: 30 }}>🔥</Text>
          <View>
            <Text style={styles.streakNum}>{streak}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </View>
        </View>
        <View style={styles.streakDots}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
            const dateStr = weekDates[i];
            const active  = activeDates.has(dateStr);
            const isToday = dateStr === todayStr;
            const future  = dateStr > todayStr;
            return (
              <View key={i} style={styles.dotCol}>
                <View style={[
                  styles.dot,
                  active  ? styles.dotFilled :
                  isToday ? styles.dotToday  :
                  future  ? styles.dotEmpty  :
                  styles.dotEmpty,
                ]} />
                <Text style={[styles.dotLabel, isToday && { color: colors.accent.primary, fontFamily: typography.fonts.bodyMed }]}>{day}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ height: 110 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.base },

  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl, paddingTop: 52 },
  greeting: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary },
  name:     { fontFamily: typography.fonts.display, fontSize: typography.sizes['2xl'], color: colors.text.primary },
  dateChip: { backgroundColor: colors.bg.secondary, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border.subtle },
  dateText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.secondary },

  heroCard:   { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.accent.primary + '35', borderRadius: radius['2xl'], padding: spacing.xl, alignItems: 'center', marginBottom: spacing.base, shadowColor: 'rgba(15,23,42,1)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  ring:       { width: 180, height: 180, borderRadius: 90, borderWidth: 14, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 0 }, marginBottom: spacing.sm },
  scoreNum:   { fontFamily: typography.fonts.display, fontSize: typography.sizes['5xl'] },
  scoreLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, letterSpacing: 4 },
  delta:      { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, marginBottom: spacing.base },
  pillsRow:   { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  pillDot:    { width: 6, height: 6, borderRadius: 3 },
  pillLabel:  { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.secondary },
  pillScore:  { fontFamily: typography.fonts.mono, fontSize: typography.sizes.xs },

  targetsCard:      { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.base, marginBottom: spacing.base },
  targetsGoalLabel: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.text.secondary, marginBottom: spacing.sm },
  targetsRow:       { flexDirection: 'row', alignItems: 'center' },
  targetChip:       { flex: 1, alignItems: 'center', gap: 2 },
  targetVal:        { fontFamily: typography.fonts.heading, fontSize: typography.sizes.md, color: colors.text.primary },
  targetLbl:        { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },
  targetDiv:        { width: 1, height: 32, backgroundColor: colors.border.subtle },

  planCard:      { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius['2xl'], padding: spacing.base, marginBottom: spacing.base },
  planHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.base },
  planTitle:     { fontFamily: typography.fonts.heading, fontSize: typography.sizes.md, color: colors.text.primary },
  planTime:      { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 3 },
  freeBadge:     { backgroundColor: colors.bg.elevated, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  freeBadgeText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.text.tertiary },
  proBadge:      { backgroundColor: colors.accent.dim, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  proBadgeText:  { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },
  planRows:      { gap: spacing.sm },
  planRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planRowText:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.primary, flex: 1 },
  blurBar:       { flex: 1, height: 14, backgroundColor: colors.bg.elevated, borderRadius: radius.full },
  unlockBtn:     { backgroundColor: colors.accent.primary, borderRadius: radius.full, paddingVertical: 14, alignItems: 'center', marginTop: spacing.base },
  unlockText:    { fontFamily: typography.fonts.display, fontSize: typography.sizes.base, color: colors.text.inverse },
  unlockSub:     { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.inverse, opacity: 0.75, marginTop: 3 },

  sectionTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary, marginBottom: spacing.sm, marginTop: spacing.xs },
  quickRow:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base },
  quickBtn:     { flex: 1, backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.lg, paddingVertical: spacing.base, alignItems: 'center', gap: 6 },
  quickLabel:   { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.text.secondary },

  statCard:    { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.base, width: 108, marginRight: spacing.sm, alignItems: 'center', gap: 4 },
  statVal:     { fontFamily: typography.fonts.heading, fontSize: typography.sizes.lg },
  statLabel:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.secondary },
  statBarBg:   { width: '100%', height: 3, backgroundColor: colors.bg.elevated, borderRadius: 2, marginTop: 2, overflow: 'hidden' },
  statBarFill: { height: '100%', borderRadius: 2 },

  streakCard:  { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.base, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streakLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  streakNum:   { fontFamily: typography.fonts.display, fontSize: typography.sizes['2xl'], color: colors.accent.primary },
  streakLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary },
  streakDots:  { flexDirection: 'row', gap: 8 },
  dotCol:      { alignItems: 'center', gap: 4 },
  dot:         { width: 10, height: 10, borderRadius: 5 },
  dotFilled:   { backgroundColor: colors.accent.primary },
  dotToday:    { borderWidth: 2, borderColor: colors.accent.primary, backgroundColor: 'transparent' },
  dotEmpty:    { backgroundColor: colors.bg.elevated },
  dotLabel:    { fontFamily: typography.fonts.body, fontSize: 9, color: colors.text.tertiary },
});

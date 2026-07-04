import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { colors, withAlpha } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { elevation } from '../../constants/elevation';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { useUserStore } from '../../stores/userStore';
import { useNutritionStore } from '../../stores/nutritionStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { GOAL_TO_BODY_PART, TYPE_TO_BODY_PART, BODY_PART_LABEL } from '../../services/exercisedb';
import { computeTargets, GOAL_LABELS } from '../../services/recommendations';
import { dateStr, daysAgoStr } from '../../services/dateUtils';
import { useZenovaScore, computeDayScore, formatDeltaLabel } from '../../hooks/useNovraScore';
import { AICoachBanner } from '../../components/ui/AICoachBanner';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ProgressRing, CountUpText } from '../../components/ui/ProgressRing';
import { AnimatedBar } from '../../components/ui/AnimatedBar';
import { hapticTap } from '../../services/haptics';
import { SparklineChart } from '../../components/ui/SparklineChart';
import { useT } from '../../constants/i18n';
import {
  Icon, Footprints, Flame, MoonStar, Zap, Target, Dumbbell, Salad, Moon,
  MessageCircle, ChevronRight, Apple, ClipboardCheck, TrendingUp,
} from '../../components/ui/Icon';

function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return 'home.goodMorning';
  if (h < 18) return 'home.goodAfternoon';
  return 'home.goodEvening';
}

export default function HomeScreen() {
  const t                = useT();
  const isPro            = useSubscriptionStore((s) => s.isPro);
  const profile          = useUserStore((s) => s.profile);
  const entries          = useNutritionStore((s) => s.entries);
  const selectedType     = useWorkoutStore((s) => s.selectedType);
  const workoutHistory   = useWorkoutStore((s) => s.history);
  const recoveryEntries  = useRecoveryStore((s) => s.entries);

  // Recomputed on every render to avoid stale dates after midnight.
  const todayDate = new Date();
  const todayStr  = dateStr(todayDate);
  const today     = todayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const targets    = useMemo(() => computeTargets(profile), [profile]);
  const { score, scoreColor, pillars, delta, deltaColor, todayCalories, calPct } = useZenovaScore();
  const deltaLabel = formatDeltaLabel(delta, t('score.sameAsYesterday'));

  const proteinLeft = useMemo(() => {
    const todayProtein = entries
      .filter((e) => e.date === todayStr)
      .reduce((s, e) => s + e.protein, 0);
    // Ceil to whole grams for display — summed 0.1g-precision floats carry FP
    // noise, and rounding up never understates what's still needed (F11).
    return Math.max(0, Math.ceil(targets.protein - todayProtein));
  }, [entries, todayStr, targets.protein]);

  // ── Streak (starts from yesterday if today has no data yet) ──
  const activeDates = useMemo(() => new Set([
    ...entries.map((e) => e.date),
    ...recoveryEntries.map((e) => e.date),
  ]), [entries, recoveryEntries]);

  const streak = useMemo(() => {
    const startFrom = activeDates.has(todayStr) ? 0 : 1;
    let count = 0;
    // Walks back day-by-day and breaks on the first gap, so it allocates only
    // `streak + 1` date strings in practice — not 365. The 365 cap is just a
    // safety bound for the (unreachable) case of a full year of unbroken logging.
    for (let i = startFrom; i <= 365; i++) {
      const d = daysAgoStr(i);
      if (activeDates.has(d)) { count++; } else { break; }
    }
    return count;
  }, [activeDates, todayStr]);

  // ── Current week Mon→Sun ──
  const weekDates = useMemo(() => {
    const mondayOffset = todayDate.getDay() === 0 ? -6 : 1 - todayDate.getDay();
    const base = todayDate.getTime();
    return Array.from({ length: 7 }, (_, i) =>
      dateStr(new Date(base + (mondayOffset + i) * 86_400_000))
    );
  // Depend on `todayStr` (the day string), not `todayDate` (a fresh Date every
  // render). The week only needs to recompute when the calendar day changes;
  // keying on the Date object would recompute on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStr]);

  // ── Workout meta ──
  const primaryGoal = profile?.primary_goal ?? 'general_health';
  const bodyPart    = selectedType
    ? (TYPE_TO_BODY_PART[selectedType] ?? GOAL_TO_BODY_PART[primaryGoal] ?? 'chest')
    : (GOAL_TO_BODY_PART[primaryGoal] ?? 'chest');
  const isRestDay   = selectedType === 'rest';
  const workoutMeta = BODY_PART_LABEL[bodyPart] ?? { name: 'Custom Workout', duration: '30 min', intensity: 'Moderate' };

  // Sleep: from today's recovery check-in
  const todayRecovery   = useMemo(
    () => recoveryEntries.find((e) => e.date === todayStr),
    [recoveryEntries, todayStr],
  );
  const sleepH          = todayRecovery?.sleepHours ?? 0;
  const sleepTarget     = targets.sleepHours;
  const sleepPct        = sleepH > 0 ? Math.min(sleepH / sleepTarget, 1) : 0;

  // Active minutes: from today's completed workouts. New records carry a
  // numeric durationMinutes; legacy records fall back to parsing the string.
  const activeMins = useMemo(() => {
    return workoutHistory
      .filter((w) => w.date === todayStr)
      .reduce((sum, w) => {
        const m = w.durationMinutes ?? (parseInt(w.duration) || 0);
        return sum + m;
      }, 0);
  }, [workoutHistory, todayStr]);
  const workoutTarget = targets.workoutMinutes;

  // ── 7-day LifeScore history (for trend chart) ──
  // Same computeDayScore as the hero score/delta, so today's trend point
  // always matches the hero number.
  const weekScores = useMemo(() => {
    const inputs = {
      entries,
      workoutHistory,
      recoveryEntries,
      targets: { calories: targets.calories, sleepHours: targets.sleepHours },
      restDaySelected: selectedType === 'rest',
    };
    return Array.from({ length: 7 }, (_, i) =>
      computeDayScore(daysAgoStr(6 - i), inputs).score
    );
  }, [entries, recoveryEntries, workoutHistory, targets, selectedType]);

  const weekLabels = weekDates.map((d) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })
  );

  const stats = [
    { icon: Footprints, value: '0',                                          label: t('home.steps'),    color: colors.accent.primary, pct: 0 },
    { icon: Flame,      value: todayCalories > 0 ? `${todayCalories}` : '0', label: t('home.calories'), color: colors.status.warning, pct: calPct },
    { icon: MoonStar,   value: sleepH > 0 ? `${sleepH}h` : '0h',            label: t('home.sleepStat'), color: colors.violet.primary, pct: sleepPct },
    { icon: Zap,        value: activeMins > 0 ? `${activeMins}m` : '0m',    label: t('home.active'),   color: colors.status.success, pct: workoutTarget > 0 ? Math.min(activeMins / workoutTarget, 1) : 0 },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t(greetingKey())}</Text>
          <Text style={styles.name}>{profile?.name ?? t('home.defaultUser')}</Text>
        </View>
        <TouchableOpacity
          style={styles.dateChip}
          onPress={() => router.push('/(tabs)/profile')}
          accessibilityRole="button"
          accessibilityLabel={t('home.openProfile')}
        >
          <Text style={styles.dateText}>{today}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Novra Score Hero ── */}
      <Card variant="hero" style={styles.heroCard}>
        <View style={styles.ringWrap}>
          <ProgressRing progress={score / 100} size={180} strokeWidth={14} color={scoreColor}>
            <CountUpText value={score} style={[styles.scoreNum, { color: scoreColor }]} />
            <Text style={styles.scoreLabel}>LIFESCORE</Text>
          </ProgressRing>
        </View>
        <Text style={[styles.delta, { color: deltaColor }]}>{t('home.vsYesterday', { delta: deltaLabel })}</Text>

        <View style={styles.pillsRow}>
          {pillars.map((p) => (
            <View
              key={p.labelKey}
              style={[styles.pill, { borderColor: withAlpha(p.color, 0.3) }]}
            >
              <View style={[styles.pillDot, { backgroundColor: p.color }]} />
              <Text style={styles.pillLabel}>{t(p.labelKey)}</Text>
              <Text style={[styles.pillScore, { color: p.color }]}>{p.value}/25</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* ── Daily Targets ── */}
      <Card style={styles.targetsCard}>
        <View style={styles.targetsGoalRow}>
          <Icon icon={Target} size="sm" color={colors.accent.primary} />
          <Text style={styles.targetsGoalLabel}>
            {GOAL_LABELS[primaryGoal] ?? t('home.healthyLifestyle')}
          </Text>
        </View>
        <View style={styles.targetsRow}>
          <View style={styles.targetChip}>
            <Text style={styles.targetVal}>{targets.calories.toLocaleString()}</Text>
            <Text style={styles.targetLbl}>{t('home.kcal')}</Text>
          </View>
          <View style={styles.targetDiv} />
          <View style={styles.targetChip}>
            <Text style={styles.targetVal}>{targets.protein}g</Text>
            <Text style={styles.targetLbl}>{t('home.protein')}</Text>
          </View>
          <View style={styles.targetDiv} />
          <View style={styles.targetChip}>
            <Text style={styles.targetVal}>{targets.sleepHours}h</Text>
            <Text style={styles.targetLbl}>{t('home.sleep')}</Text>
          </View>
          <View style={styles.targetDiv} />
          <View style={styles.targetChip}>
            <Text style={styles.targetVal}>{targets.workoutMinutes}m</Text>
            <Text style={styles.targetLbl}>{t('home.workout')}</Text>
          </View>
        </View>
      </Card>

      {/* ── Daily AI Plan ── */}
      <Card variant="raised" style={styles.planCard}>
        <View style={styles.planHeader}>
          <View>
            <Text style={styles.planTitle}>{t('home.todaysPlan')}</Text>
            <Text style={styles.planTime}>{t('home.generated', { time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) })}</Text>
          </View>
          <View style={isPro ? styles.proBadge : styles.freeBadge}>
            <Text style={isPro ? styles.proBadgeText : styles.freeBadgeText}>{isPro ? t('common.pro') : t('common.free')}</Text>
          </View>
        </View>

        <View style={styles.planRows}>
          <TouchableOpacity
            style={styles.planRow}
            onPress={() => router.push('/(tabs)/workout')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('home.openWorkoutPlan')}
          >
            <Icon icon={Dumbbell} size="md" color={colors.accent.primary} />
            <Text style={[styles.planRowText, { flex: 1 }]}>
              {isRestDay ? t('home.restDay') : `${workoutMeta.name} — ${workoutMeta.duration} · ${workoutMeta.intensity}`}
            </Text>
            <Icon icon={ChevronRight} size="md" color={colors.text.tertiary} />
          </TouchableOpacity>

          {isPro ? (
            <>
              <View style={styles.planRow}>
                <Icon icon={Salad} size="md" color={colors.status.success} />
                <Text style={styles.planRowText}>
                  {proteinLeft > 0 ? t('home.proteinNeeded', { grams: proteinLeft }) : t('home.proteinReached')}
                </Text>
              </View>
              <View style={styles.planRow}>
                <Icon icon={Moon} size="md" color={colors.violet.primary} />
                <Text style={styles.planRowText}>
                  {t('home.sleepTip', { hours: targets.sleepHours, time: targets.sleepHours >= 9 ? '9:30 PM' : targets.sleepHours >= 8.5 ? '10:00 PM' : '10:30 PM' })}
                </Text>
              </View>
              <View style={styles.planRow}>
                <Icon icon={MessageCircle} size="md" color={colors.status.info} />
                <Text style={styles.planRowText}>{t('home.motivation')}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.planRow}>
                <Icon icon={Salad} size="md" color={colors.status.success} />
                <View style={styles.blurBar} />
              </View>
              <View style={styles.planRow}>
                <Icon icon={Moon} size="md" color={colors.violet.primary} />
                <View style={styles.blurBar} />
              </View>
              <Button
                label={t('home.unlockFullPlan')}
                subLabel={t('home.unlockSub')}
                onPress={() => router.push('/paywall')}
                accessibilityLabel={t('home.unlockWithPro')}
                style={{ marginTop: spacing.base }}
              />
            </>
          )}
        </View>
      </Card>

      {/* ── First-use welcome banner ── */}
      {streak === 0 && todayCalories === 0 && (
        <View style={styles.welcomeBanner}>
          <Text style={styles.welcomeTitle}>{t('home.welcomeTitle')}</Text>
          <Text style={styles.welcomeSub}>{t('home.welcomeSub')}</Text>
          <View style={styles.welcomeSteps}>
            {[
              { num: '1', text: t('home.welcomeStep1') },
              { num: '2', text: t('home.welcomeStep2') },
              { num: '3', text: t('home.welcomeStep3') },
            ].map((s) => (
              <View key={s.num} style={styles.welcomeStep}>
                <View style={styles.welcomeStepNum}><Text style={styles.welcomeStepNumText}>{s.num}</Text></View>
                <Text style={styles.welcomeStepText}>{s.text}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Quick Log ── */}
      <Text style={styles.sectionTitle}>{t('home.quickLog')}</Text>
      <View style={styles.quickRow}>
        {[
          { icon: Apple,          label: t('home.food'),        route: '/modals/add-food' as Href },
          { icon: Dumbbell,       label: t('home.workoutQuick'), route: '/modals/log-workout' as Href },
          { icon: ClipboardCheck, label: t('home.checkin'),     route: '/(tabs)/recovery' as Href },
        ].map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.quickBtn}
            onPress={() => { hapticTap(); router.push(item.route); }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={t('home.logItem', { item: item.label })}
          >
            <Icon icon={item.icon} size="lg" color={colors.accent.primary} />
            <Text style={styles.quickLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Stats ── */}
      <Text style={styles.sectionTitle}>{t('home.todaysStats')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.base }}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Icon icon={s.icon} size="lg" color={s.color} />
            <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
            <AnimatedBar pct={s.pct} color={s.color} height={3} style={{ marginTop: 2 }} />
          </View>
        ))}
      </ScrollView>

      {/* ── This Week Trend ── */}
      <Text style={styles.sectionTitle}>{t('home.thisWeek')}</Text>
      {isPro ? (
        <Card variant="raised" style={styles.trendCard}>
          <View style={styles.trendHeader}>
            <Text style={styles.trendTitle}>{t('home.lifeScoreTrend')}</Text>
            <Text style={[styles.trendCurrent, { color: scoreColor }]}>{t('home.scoreToday', { score })}</Text>
          </View>
          <SparklineChart
            data={weekScores}
            color={colors.accent.primary}
            labels={weekLabels}
            width={320}
            height={72}
          />
        </Card>
      ) : (
        <TouchableOpacity
          style={styles.trendLocked}
          onPress={() => router.push('/paywall')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('home.trendUnlockA11y')}
        >
          <View style={styles.trendLockedInner}>
            <Icon icon={TrendingUp} size="lg" color={colors.accent.primary} />
            <View>
              <Text style={styles.trendLockedTitle}>{t('home.trendCharts')}</Text>
              <Text style={styles.trendLockedSub}>{t('home.trendUpgradeSub')}</Text>
            </View>
          </View>
          <Text style={styles.trendLockedCta}>{t('home.upgrade')}</Text>
        </TouchableOpacity>
      )}

      {/* ── AI Coach Banner ── */}
      <AICoachBanner subtitle={t('home.aiCoachSubtitle')} />

      {/* ── Streak ── */}
      <Card style={styles.streakCard}>
        <View style={styles.streakLeft}>
          <Icon icon={Flame} size={30} color={colors.status.warning} strokeWidth={2} />
          <View>
            <Text style={styles.streakNum}>{streak}</Text>
            <Text style={styles.streakLabel}>{t('home.dayStreak')}</Text>
          </View>
        </View>
        <View style={styles.streakDots}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
            const dateStr = weekDates[i];
            const active  = activeDates.has(dateStr);
            const isToday = dateStr === todayStr;
            return (
              <View key={i} style={styles.dotCol}>
                <View style={[
                  styles.dot,
                  active  ? styles.dotFilled :
                  isToday ? styles.dotToday  :
                  styles.dotEmpty,
                ]} />
                <Text style={[styles.dotLabel, isToday && { color: colors.accent.primary, fontFamily: typography.fonts.bodyMed }]}>{day}</Text>
              </View>
            );
          })}
        </View>
      </Card>

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

  heroCard:   { padding: spacing.xl, alignItems: 'center', marginBottom: spacing.base },
  ringWrap:   { marginBottom: spacing.sm },
  scoreNum:   { fontFamily: typography.fonts.mono, fontSize: typography.sizes['5xl'] },
  scoreLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, letterSpacing: 4 },
  delta:      { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, marginBottom: spacing.base },
  pillsRow:   { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  pillDot:    { width: 6, height: 6, borderRadius: 3 },
  pillLabel:  { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.secondary },
  pillScore:  { fontFamily: typography.fonts.mono, fontSize: typography.sizes.xs },
  pillLock:   { fontSize: 9 },

  targetsCard:      { marginBottom: spacing.base },
  targetsGoalRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  targetsGoalLabel: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.text.secondary },
  targetsRow:       { flexDirection: 'row', alignItems: 'center' },
  targetChip:       { flex: 1, alignItems: 'center', gap: 2 },
  targetVal:        { fontFamily: typography.fonts.mono, fontSize: typography.sizes.md, color: colors.text.primary },
  targetLbl:        { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },
  targetDiv:        { width: 1, height: 32, backgroundColor: colors.border.subtle },

  planCard:      { marginBottom: spacing.base },
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

  sectionTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary, marginBottom: spacing.sm, marginTop: spacing.xs },
  quickRow:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base },
  quickBtn:     { flex: 1, backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, paddingVertical: spacing.base, alignItems: 'center', gap: 6, ...elevation.card },
  quickLabel:   { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.text.secondary },

  statCard:    { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.base, width: 108, marginRight: spacing.sm, alignItems: 'center', gap: 4, ...elevation.card },
  statVal:     { fontFamily: typography.fonts.mono, fontSize: typography.sizes.lg },
  statLabel:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.secondary },

  welcomeBanner:       { backgroundColor: colors.accent.dim, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.21), borderRadius: radius.xl, padding: spacing.base, marginBottom: spacing.base, gap: spacing.sm },
  welcomeTitle:        { fontFamily: typography.fonts.heading, fontSize: typography.sizes.md, color: colors.text.primary },
  welcomeSub:          { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, lineHeight: 20 },
  welcomeSteps:        { gap: spacing.sm, marginTop: spacing.xs },
  welcomeStep:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  welcomeStepNum:      { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent.primary, alignItems: 'center', justifyContent: 'center' },
  welcomeStepNumText:  { fontFamily: typography.fonts.display, fontSize: typography.sizes.xs, color: colors.text.inverse },
  welcomeStepText:     { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary },

  streakCard:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streakLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  streakNum:   { fontFamily: typography.fonts.mono, fontSize: typography.sizes['2xl'], color: colors.accent.primary },
  streakLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary },
  streakDots:  { flexDirection: 'row', gap: 8 },
  dotCol:      { alignItems: 'center', gap: 4 },
  dot:         { width: 10, height: 10, borderRadius: 5 },
  dotFilled:   { backgroundColor: colors.accent.primary },
  dotToday:    { borderWidth: 2, borderColor: colors.accent.primary, backgroundColor: 'transparent' },
  dotEmpty:    { backgroundColor: colors.bg.elevated },
  dotLabel:    { fontFamily: typography.fonts.body, fontSize: 9, color: colors.text.tertiary },

  trendCard:        { marginBottom: spacing.base },
  trendHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  trendTitle:       { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.secondary },
  trendCurrent:     { fontFamily: typography.fonts.display, fontSize: typography.sizes.sm },
  trendLocked:      { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.base, marginBottom: spacing.base, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...elevation.card },
  trendLockedInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  trendLockedTitle: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.primary },
  trendLockedSub:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
  trendLockedCta:   { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.accent.primary },
});

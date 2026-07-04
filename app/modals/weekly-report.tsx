import { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useNutritionStore } from '../../stores/nutritionStore';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useUserStore } from '../../stores/userStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { computeTargets } from '../../services/recommendations';
import { buildLocalWeeklyReport } from '../../services/weeklyReport';
import { daysAgoStr } from '../../services/dateUtils';
import { colors, withAlpha } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { supabase } from '../../services/supabase';
import { useT } from '../../constants/i18n';
import { Icon, ChartColumn, X } from '../../components/ui/Icon';

const EDGE_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-coach`;

export default function WeeklyReportModal() {
  const isPro   = useSubscriptionStore((s) => s.isPro);
  const profile = useUserStore((s) => s.profile);
  const t = useT();

  const entries         = useNutritionStore((s) => s.entries);
  const recoveryEntries = useRecoveryStore((s) => s.entries);
  const workoutHistory  = useWorkoutStore((s) => s.history);
  const targets         = useMemo(() => computeTargets(profile), [profile]);

  const [report,  setReport]  = useState<string | null>(null);
  const [isLocal, setIsLocal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect free users to the paywall. Done in an effect (not during render):
  // navigating mid-render and returning before the hooks above run breaks the
  // hooks order and crashes if `isPro` flips while mounted.
  useEffect(() => {
    if (!isPro) router.replace('/paywall');
  }, [isPro]);

  // Build last 7 day summaries
  const weekSummary = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = daysAgoStr(6 - i);
      const dayLabel = new Date(Date.now() - (6 - i) * 86_400_000)
        .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      const dayCalories = entries
        .filter((e) => e.date === d)
        .reduce((s, e) => s + e.calories, 0);

      const dayRecovery = recoveryEntries.find((e) => e.date === d);
      const dayWorkouts = workoutHistory.filter((w) => w.date === d);

      return {
        date: dayLabel,
        calories: dayCalories,
        mood:      dayRecovery?.mood      ?? null,
        energy:    dayRecovery?.energy    ?? null,
        stress:    dayRecovery?.stress    ?? null,
        sleepHours: dayRecovery?.sleepHours ?? null,
        workoutsCompleted: dayWorkouts.length,
      };
    });
  }, [entries, recoveryEntries, workoutHistory]);

  const generateReport = async () => {
    setLoading(true);
    setIsLocal(false);

    const daysLogged   = weekSummary.filter((d) => d.calories > 0 || d.workoutsCompleted > 0).length;
    const avgCalories  = Math.round(weekSummary.filter((d) => d.calories > 0).reduce((s, d) => s + d.calories, 0) / Math.max(1, weekSummary.filter((d) => d.calories > 0).length));
    const totalWorkouts = weekSummary.reduce((s, d) => s + d.workoutsCompleted, 0);
    const avgMood      = weekSummary.filter((d) => d.mood).reduce((s, d) => s + (d.mood ?? 0), 0) / Math.max(1, weekSummary.filter((d) => d.mood).length);
    const avgSleep     = weekSummary.filter((d) => d.sleepHours).reduce((s, d) => s + (d.sleepHours ?? 0), 0) / Math.max(1, weekSummary.filter((d) => d.sleepHours).length);

    const dailyBreakdown = weekSummary.map((d) =>
      `${d.date}: ${d.calories > 0 ? `${d.calories} kcal` : 'no food logged'}, ${d.workoutsCompleted > 0 ? `${d.workoutsCompleted} workout(s)` : 'no workout'}, mood ${d.mood ?? 'N/A'}/5, sleep ${d.sleepHours ? `${d.sleepHours}h` : 'N/A'}`
    ).join('\n');

    const prompt = `Generate a concise weekly health & fitness report for the past 7 days.

USER'S TARGETS: ${targets.calories} kcal/day, ${targets.protein}g protein, ${targets.sleepHours}h sleep, goal: ${profile?.primary_goal ?? 'general_health'}.

PAST 7 DAYS:
${dailyBreakdown}

SUMMARY STATS:
- Days with data logged: ${daysLogged}/7
- Average daily calories: ${avgCalories > 0 ? avgCalories : 'not logged'}
- Total workouts completed: ${totalWorkouts}
- Average mood: ${avgMood > 0 ? avgMood.toFixed(1) : 'not logged'}/5
- Average sleep: ${avgSleep > 0 ? `${avgSleep.toFixed(1)}h` : 'not logged'}

Please structure the report as:
1. **This Week's Wins** – 2-3 specific positives from their data
2. **Areas to Improve** – 2-3 honest, actionable observations
3. **Next Week Focus** – 3 concrete, personalized actions to take

Keep it motivating, honest, and specific to their numbers. Be brief and direct.`;

    try {
      // Send the user's session JWT so the edge function can authenticate and
      // rate-limit the caller (anon key carries no user identity).
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(t('weeklyReport.signInError'));

      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          userProfile: profile ? { primary_goal: profile.primary_goal, gender: profile.gender } : null,
          mode: 'weekly_report',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Error ${res.status}`);
      }
      const data = await res.json();
      setReport(data?.content ?? t('weeklyReport.noReport'));
    } catch {
      // AI path unavailable (edge function not deployed yet, offline, or
      // server error) — build the report on-device from the same stats so
      // the feature always produces a result.
      setReport(buildLocalWeeklyReport(
        { daysLogged, avgCalories, totalWorkouts, avgMood, avgSleep },
        targets,
        t,
      ));
      setIsLocal(true);
    } finally {
      setLoading(false);
    }
  };

  // Render nothing while the paywall redirect (effect above) takes over.
  if (!isPro) return null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBadge}><Icon icon={ChartColumn} size="md" color={colors.accent.primary} /></View>
          <View>
            <Text style={styles.title}>{t('weeklyReport.title')}</Text>
            <Text style={styles.sub}>{t('weeklyReport.subtitle')}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel={t('weeklyReport.closeA11y')}>
          <Icon icon={X} size="md" color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {/* This Week Snapshot */}
      <Text style={styles.sectionTitle}>{t('weeklyReport.thisWeek')}</Text>
      <View style={styles.snapshotGrid}>
        {weekSummary.map((d, i) => {
          const hasData = d.calories > 0 || d.workoutsCompleted > 0 || d.mood != null;
          const dayShort = new Date(Date.now() - (6 - i) * 86_400_000)
            .toLocaleDateString('en-US', { weekday: 'narrow' });
          return (
            <View key={i} style={[styles.dayDot, hasData && styles.dayDotActive]}>
              <Text style={[styles.dayDotLabel, hasData && styles.dayDotLabelActive]}>{dayShort}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.statsRow}>
        {[
          { label: t('weeklyReport.daysLogged'), value: `${weekSummary.filter((d) => d.calories > 0 || d.workoutsCompleted > 0).length}/7` },
          { label: t('weeklyReport.workouts'), value: String(weekSummary.reduce((s, d) => s + d.workoutsCompleted, 0)) },
          { label: t('weeklyReport.avgSleep'), value: (() => { const v = weekSummary.filter((d) => d.sleepHours); return v.length ? `${(v.reduce((s, d) => s + (d.sleepHours ?? 0), 0) / v.length).toFixed(1)}h` : '—'; })() },
        ].map((s) => (
          <View key={s.label} style={styles.statChip}>
            <Text style={styles.statVal}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Report content */}
      {!report && !loading && (
        <TouchableOpacity style={styles.generateBtn} onPress={generateReport} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('weeklyReport.generateA11y')}>
          <Text style={styles.generateBtnText}>{t('weeklyReport.generate')}</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.accent.primary} size="large" />
          <Text style={styles.loadingText}>{t('weeklyReport.analyzing')}</Text>
        </View>
      )}

      {report && (
        <View style={styles.reportCard}>
          <Text style={styles.reportText}>{report}</Text>
          {isLocal && <Text style={styles.localNote}>{t('weeklyReport.localNote')}</Text>}
          <TouchableOpacity style={styles.regenerateBtn} onPress={generateReport} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('weeklyReport.regenerateA11y')}>
            <Text style={styles.regenerateText}>{t('weeklyReport.regenerate')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.base, paddingTop: spacing.xl },

  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBadge:  { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent.dim, alignItems: 'center', justifyContent: 'center' },
  title:      { fontFamily: typography.fonts.heading, fontSize: typography.sizes.md, color: colors.text.primary },
  sub:        { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },

  sectionTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary, marginBottom: spacing.sm },

  snapshotGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.base },
  dayDot:       { flex: 1, alignItems: 'center', gap: 5 },
  dayDotActive: {},
  dayDotLabel:  { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },
  dayDotLabelActive: { color: colors.accent.primary, fontFamily: typography.fonts.bodyMed },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  statChip: { flex: 1, backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.lg, padding: spacing.base, alignItems: 'center', gap: 3 },
  statVal:  { fontFamily: typography.fonts.display, fontSize: typography.sizes.lg, color: colors.accent.primary },
  statLabel:{ fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.secondary },

  generateBtn:     { backgroundColor: colors.accent.primary, borderRadius: radius.full, paddingVertical: 16, alignItems: 'center' },
  generateBtnText: { fontFamily: typography.fonts.display, fontSize: typography.sizes.base, color: colors.text.inverse },

  loadingBox:  { alignItems: 'center', gap: spacing.base, paddingVertical: spacing['2xl'] },
  loadingText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary },

  reportCard:      { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.19), borderRadius: radius['2xl'], padding: spacing.xl, gap: spacing.xl },
  localNote:       { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, textAlign: 'center', marginTop: -spacing.sm },
  reportText:      { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.primary, lineHeight: 22 },
  regenerateBtn:   { alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  regenerateText:  { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.tertiary },
});

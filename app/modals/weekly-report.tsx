import { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useNutritionStore } from '../../stores/nutritionStore';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useWeightLogStore } from '../../stores/weightLogStore';
import { useUserStore } from '../../stores/userStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { computeTargets } from '../../services/recommendations';
import {
  computeWeekData, buildLocalSections, WeeklyReportData,
} from '../../services/weeklyReport';
import { exportReportPdf } from '../../services/reportPdf';
import { colors, withAlpha } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { supabase } from '../../services/supabase';
import { useT } from '../../constants/i18n';
import { Icon, ChartColumn, X, Check, Target, Download } from '../../components/ui/Icon';
import { SkeletonParagraph } from '../../components/ui/Skeleton';
import { AnimatedBar } from '../../components/ui/AnimatedBar';

const EDGE_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-coach`;

const scoreColor = (score: number) =>
  score >= 70 ? colors.score.excellent :
  score >= 50 ? colors.score.good :
  score >= 30 ? colors.score.fair :
  colors.score.poor;

export default function WeeklyReportModal() {
  const isPro   = useSubscriptionStore((s) => s.isPro);
  const profile = useUserStore((s) => s.profile);
  const t = useT();

  const entries         = useNutritionStore((s) => s.entries);
  const recoveryEntries = useRecoveryStore((s) => s.entries);
  const workoutHistory  = useWorkoutStore((s) => s.history);
  const selectedType    = useWorkoutStore((s) => s.selectedType);
  const weightEntries   = useWeightLogStore((s) => s.entries);
  const targets         = useMemo(() => computeTargets(profile), [profile]);

  const [data,      setData]      = useState<WeeklyReportData | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);

  // Redirect free users to the paywall. Done in an effect (not during render):
  // navigating mid-render and returning before the hooks above run breaks the
  // hooks order and crashes if `isPro` flips while mounted.
  useEffect(() => {
    if (!isPro) router.replace('/paywall');
  }, [isPro]);

  // Structured week aggregation — single source for the snapshot row, the
  // report cards AND the PDF. Charts never depend on the AI response.
  const week = useMemo(() => computeWeekData({
    entries,
    workoutHistory,
    recoveryEntries,
    weightEntries,
    targets: { calories: targets.calories, sleepHours: targets.sleepHours },
    restDaySelected: selectedType === 'rest',
  }), [entries, workoutHistory, recoveryEntries, weightEntries, targets, selectedType]);

  const generateReport = async () => {
    setLoading(true);

    const { period, stats, daily } = week;
    const sections = buildLocalSections(stats, targets, t);
    const base: Omit<WeeklyReportData, 'aiNarrative' | 'source'> = { period, stats, daily, sections };

    const dailyBreakdown = daily.map((d, i) => {
      const dayEntries  = entries.filter((e) => e.date === d.date);
      const dayCalories = dayEntries.reduce((s, e) => s + e.calories, 0);
      const recovery    = recoveryEntries.find((e) => e.date === d.date);
      const dayWorkouts = workoutHistory.filter((w) => w.date === d.date).length;
      const label = new Date(Date.now() - (6 - i) * 86_400_000)
        .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return `${label}: ${dayCalories > 0 ? `${dayCalories} kcal` : 'no food logged'}, ${dayWorkouts > 0 ? `${dayWorkouts} workout(s)` : 'no workout'}, mood ${recovery?.mood ?? 'N/A'}/5, sleep ${recovery?.sleepHours ? `${recovery.sleepHours}h` : 'N/A'}`;
    }).join('\n');

    const prompt = `Generate a concise weekly health & fitness report for the past 7 days.

USER'S TARGETS: ${targets.calories} kcal/day, ${targets.protein}g protein, ${targets.sleepHours}h sleep, goal: ${profile?.primary_goal ?? 'general_health'}.

PAST 7 DAYS:
${dailyBreakdown}

SUMMARY STATS:
- Days with data logged: ${stats.daysLogged}/7
- Average daily calories: ${stats.avgCalories > 0 ? stats.avgCalories : 'not logged'}
- Total workouts completed: ${stats.totalWorkouts}
- Average mood: ${stats.avgMood > 0 ? stats.avgMood.toFixed(1) : 'not logged'}/5
- Average sleep: ${stats.avgSleep > 0 ? `${stats.avgSleep.toFixed(1)}h` : 'not logged'}

Write a short motivating coach's summary (5-8 sentences) of their week: call out what went well, what to watch, and the single most important thing to change next week. Be honest, specific to their numbers, and direct. Plain text only — no markdown, no headers, no bullet lists.`;

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
      const resData = await res.json();
      const narrative = typeof resData?.content === 'string' ? resData.content.trim() : '';
      if (!narrative) throw new Error('empty AI response');
      setData({ ...base, aiNarrative: narrative, source: 'ai' });
    } catch {
      // AI path unavailable (offline or server error) — the rule-based
      // sections computed above stand alone, so the report always renders.
      setData({ ...base, aiNarrative: null, source: 'local' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!data || exporting) return;
    setExporting(true);
    try {
      await exportReportPdf(data, t);
    } catch {
      Alert.alert(t('common.error'), t('weeklyReport.pdfError'));
    } finally {
      setExporting(false);
    }
  };

  // Render nothing while the paywall redirect (effect above) takes over.
  if (!isPro) return null;

  const stats = week.stats;
  const noData = data !== null && data.stats.daysLogged === 0;

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
        {week.daily.map((d) => (
          <View key={d.date} style={styles.dayDot}>
            <Text style={[styles.dayDotLabel, d.hasData && styles.dayDotLabelActive]}>{d.dayLabel}</Text>
          </View>
        ))}
      </View>

      <View style={styles.statsRow}>
        {[
          { label: t('weeklyReport.daysLogged'), value: `${stats.daysLogged}/7` },
          { label: t('weeklyReport.workouts'), value: String(stats.totalWorkouts) },
          { label: t('weeklyReport.avgSleep'), value: stats.avgSleep > 0 ? `${stats.avgSleep.toFixed(1)}h` : '—' },
        ].map((s) => (
          <View key={s.label} style={styles.statChip}>
            <Text style={styles.statVal}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Generate */}
      {!data && !loading && (
        <TouchableOpacity style={styles.generateBtn} onPress={generateReport} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('weeklyReport.generateA11y')}>
          <Text style={styles.generateBtnText}>{t('weeklyReport.generate')}</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={styles.loadingBox}>
          <SkeletonParagraph style={{ width: '100%' }} />
          <SkeletonParagraph style={{ width: '100%' }} />
          <Text style={styles.loadingText}>{t('weeklyReport.analyzing')}</Text>
        </View>
      )}

      {/* No-data week */}
      {noData && (
        <View style={styles.card}>
          <Text style={styles.bodyText}>{t('weeklyReport.local.noData')}</Text>
        </View>
      )}

      {data && !noData && (
        <>
          {/* Score trend */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{t('weeklyReport.scoreTrend')}</Text>
              <View style={styles.avgScoreWrap}>
                <Text style={[styles.avgScoreNum, { color: scoreColor(data.stats.avgScore) }]}>{data.stats.avgScore}</Text>
                <Text style={styles.avgScoreLabel}>{t('weeklyReport.avgScore')}</Text>
              </View>
            </View>
            <View style={styles.trendRow}>
              {data.daily.map((d) => (
                <View key={d.date} style={styles.trendCol}>
                  <View style={styles.trendBarTrack}>
                    <View style={[
                      styles.trendBar,
                      d.hasData
                        ? { height: `${Math.max(d.score, 6)}%`, backgroundColor: scoreColor(d.score) }
                        : { height: 4, backgroundColor: colors.border.subtle },
                    ]} />
                  </View>
                  <Text style={styles.trendDay}>{d.dayLabel}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Pillars */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('weeklyReport.pillars')}</Text>
            {[
              { label: t('weeklyReport.pillarSleep'), value: data.stats.pillarAvgs.sleep, color: colors.accent.primary },
              { label: t('weeklyReport.pillarFood'),  value: data.stats.pillarAvgs.food,  color: colors.status.success },
              { label: t('weeklyReport.pillarMove'),  value: data.stats.pillarAvgs.move,  color: colors.status.warning },
              { label: t('weeklyReport.pillarMood'),  value: data.stats.pillarAvgs.mood,  color: colors.violet.primary },
            ].map((p) => (
              <View key={p.label} style={styles.pillarRow}>
                <Text style={styles.pillarLabel}>{p.label}</Text>
                <AnimatedBar pct={p.value / 25} color={p.color} height={8} style={styles.pillarBar} />
                <Text style={styles.pillarVal}>{p.value}/25</Text>
              </View>
            ))}
          </View>

          {/* Nutrition */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('weeklyReport.nutrition')}</Text>
            <View style={styles.nutritionRow}>
              <View>
                <Text style={styles.bigStat}>{data.stats.avgCalories > 0 ? `${data.stats.avgCalories}` : '—'}</Text>
                <Text style={styles.bigStatLabel}>
                  {t('weeklyReport.avgCaloriesLabel')} · {t('weeklyReport.ofTarget', { target: targets.calories })}
                </Text>
              </View>
            </View>
            {data.stats.avgCalories > 0 && (
              <View style={styles.macroRow}>
                {[
                  { label: t('weeklyReport.protein'), value: data.stats.macroAvgs.protein },
                  { label: t('weeklyReport.carbs'),   value: data.stats.macroAvgs.carbs },
                  { label: t('weeklyReport.fat'),     value: data.stats.macroAvgs.fat },
                ].map((m) => (
                  <View key={m.label} style={styles.macroChip}>
                    <Text style={styles.macroVal}>{m.value}g</Text>
                    <Text style={styles.macroLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Workouts */}
          {data.stats.totalWorkouts > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('weeklyReport.workoutsSection')}</Text>
              <View style={styles.macroRow}>
                {[
                  { label: t('weeklyReport.workouts'), value: String(data.stats.totalWorkouts) },
                  { label: t('weeklyReport.totalTime'), value: `${data.stats.workoutBreakdown.reduce((s, w) => s + w.minutes, 0)}m` },
                  { label: t('weeklyReport.burned'), value: `${data.stats.workoutBreakdown.reduce((s, w) => s + w.calories, 0)}` },
                ].map((m) => (
                  <View key={m.label} style={styles.macroChip}>
                    <Text style={styles.macroVal}>{m.value}</Text>
                    <Text style={styles.macroLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>
              {data.stats.workoutBreakdown.map((w) => (
                <View key={w.bodyPart} style={styles.breakdownRow}>
                  <Text style={styles.breakdownName}>{w.bodyPart}</Text>
                  <Text style={styles.breakdownMeta}>×{w.count} · {t('weeklyReport.minutes', { count: w.minutes })}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Weight */}
          {data.stats.weightDelta !== null && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('weeklyReport.weightChange')}</Text>
              <Text style={[
                styles.bigStat,
                { color: data.stats.weightDelta > 0 ? colors.status.warning : colors.accent.primary },
              ]}>
                {data.stats.weightDelta > 0 ? '+' : ''}{data.stats.weightDelta} kg
              </Text>
              <Text style={styles.bigStatLabel}>{t('weeklyReport.weightThisWeek')}</Text>
            </View>
          )}

          {/* Coach's notes (AI path only) */}
          {data.aiNarrative && (
            <View style={[styles.card, styles.coachCard]}>
              <Text style={styles.cardTitle}>{t('weeklyReport.coachNotes')}</Text>
              <Text style={styles.bodyText}>{data.aiNarrative}</Text>
            </View>
          )}

          {/* Wins / Improve / Focus */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🏆  {t('weeklyReport.local.winsHeader')}</Text>
            {data.sections.wins.map((s) => (
              <View key={s} style={styles.bulletRow}>
                <Icon icon={Check} size={15} color={colors.status.success} strokeWidth={2.5} />
                <Text style={styles.bulletText}>{s}</Text>
              </View>
            ))}
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🎯  {t('weeklyReport.local.improveHeader')}</Text>
            {data.sections.improvements.map((s) => (
              <View key={s} style={styles.bulletRow}>
                <Icon icon={Target} size={15} color={colors.status.warning} strokeWidth={2.5} />
                <Text style={styles.bulletText}>{s}</Text>
              </View>
            ))}
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🚀  {t('weeklyReport.local.focusHeader')}</Text>
            {data.sections.focus.map((s, i) => (
              <View key={s} style={styles.bulletRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                <Text style={styles.bulletText}>{s}</Text>
              </View>
            ))}
          </View>

          {data.source === 'local' && <Text style={styles.localNote}>{t('weeklyReport.localNote')}</Text>}

          {/* Download PDF */}
          <TouchableOpacity
            style={styles.pdfBtn}
            onPress={handleDownloadPdf}
            disabled={exporting}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('weeklyReport.downloadPdfA11y')}
          >
            {exporting
              ? (
                <>
                  <ActivityIndicator size="small" color={colors.accent.primary} />
                  <Text style={styles.pdfBtnText}>{t('weeklyReport.exporting')}</Text>
                </>
              )
              : (
                <>
                  <Icon icon={Download} size={17} color={colors.accent.primary} strokeWidth={2.2} />
                  <Text style={styles.pdfBtnText}>{t('weeklyReport.downloadPdf')}</Text>
                </>
              )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.regenerateBtn} onPress={generateReport} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('weeklyReport.regenerateA11y')}>
            <Text style={styles.regenerateText}>{t('weeklyReport.regenerate')}</Text>
          </TouchableOpacity>
        </>
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

  card: {
    backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle,
    borderRadius: radius['2xl'], padding: spacing.xl, marginBottom: spacing.base, gap: spacing.sm,
  },
  coachCard: { borderColor: withAlpha(colors.accent.primary, 0.28), borderLeftWidth: 3, borderLeftColor: colors.accent.primary },
  cardTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  bodyText:  { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.primary, lineHeight: 22 },

  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  avgScoreWrap:  { alignItems: 'flex-end' },
  avgScoreNum:   { fontFamily: typography.fonts.display, fontSize: typography.sizes.xl },
  avgScoreLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },

  trendRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, marginTop: spacing.xs },
  trendCol:      { flex: 1, alignItems: 'center', gap: 5 },
  trendBarTrack: { height: 88, width: '100%', justifyContent: 'flex-end' },
  trendBar:      { width: '100%', borderRadius: radius.sm },
  trendDay:      { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },

  pillarRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pillarLabel: { width: 46, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary },
  pillarBar:   { flex: 1 },
  pillarVal:   { width: 46, textAlign: 'right', fontFamily: typography.fonts.mono, fontSize: typography.sizes.xs, color: colors.text.primary },

  nutritionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  bigStat:      { fontFamily: typography.fonts.display, fontSize: typography.sizes.xl, color: colors.text.primary },
  bigStatLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },

  macroRow:   { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  macroChip:  { flex: 1, backgroundColor: colors.bg.tertiary, borderRadius: radius.lg, paddingVertical: spacing.sm, alignItems: 'center', gap: 2 },
  macroVal:   { fontFamily: typography.fonts.display, fontSize: typography.sizes.base, color: colors.text.primary },
  macroLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.secondary },

  breakdownRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.subtle, marginTop: spacing.sm },
  breakdownName: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.primary, textTransform: 'capitalize' },
  breakdownMeta: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary },

  bulletRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bulletText: { flex: 1, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.primary, lineHeight: 21 },
  stepNum:     { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent.dim, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },

  localNote: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, textAlign: 'center', marginBottom: spacing.sm },

  pdfBtn: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.accent.primary, borderRadius: radius.full,
    paddingVertical: 14, backgroundColor: withAlpha(colors.accent.primary, 0.06),
  },
  pdfBtnText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.accent.primary },

  regenerateBtn:  { alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, marginTop: spacing.xs },
  regenerateText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.tertiary },
});

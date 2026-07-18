import { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform, TextInput } from 'react-native';

const HEALTH_APP = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useUserStore } from '../../stores/userStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { computeTargets } from '../../services/recommendations';
import { computeFatigueScore } from '../../services/progressUtils';
import { daysAgoStr } from '../../services/dateUtils';
import { colors, withAlpha } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { elevation } from '../../constants/elevation';
import { AICoachBanner } from '../../components/ui/AICoachBanner';
import { Button } from '../../components/ui/Button';
import { AnimatedBar } from '../../components/ui/AnimatedBar';
import { SegmentMeter } from '../../components/ui/SegmentMeter';
import { hapticTap, hapticSuccess } from '../../services/haptics';
import { useAnalytics } from '../../services/analytics';
import { useT } from '../../constants/i18n';
import {
  Icon, IconComponent, MoonStar, Moon, HeartPulse, Frown, Smile, Battery, Zap,
  Leaf, Angry, Lock,
} from '../../components/ui/Icon';

type RatingKey = 'mood' | 'energy' | 'stress';

const METRICS: { key: RatingKey; labelKey: string; low: IconComponent; high: IconComponent; color: string }[] = [
  { key: 'mood',   labelKey: 'recovery.mood',   low: Frown,   high: Smile, color: colors.status.warning },
  { key: 'energy', labelKey: 'recovery.energy', low: Battery, high: Zap,   color: colors.accent.primary },
  { key: 'stress', labelKey: 'recovery.stress', low: Leaf,    high: Angry, color: colors.status.danger },
];

export default function RecoveryScreen() {
  const insets          = useSafeAreaInsets();
  const saveEntry       = useRecoveryStore((s) => s.saveEntry);
  const recoveryEntries = useRecoveryStore((s) => s.entries);
  const profile         = useUserStore((s) => s.profile);
  const analytics       = useAnalytics();
  const t               = useT();
  const targets         = useMemo(() => computeTargets(profile), [profile]);
  const todayStr        = daysAgoStr(0);
  const todayEntry      = recoveryEntries.find((e) => e.date === todayStr);
  const isPro           = useSubscriptionStore((s) => s.isPro);

  // ── Fatigue score (Pro) — needs a few days of check-ins to be meaningful ──
  const fatigue = useMemo(
    () => (recoveryEntries.length >= 3 ? computeFatigueScore(recoveryEntries) : null),
    [recoveryEntries],
  );
  const fatigueLevel = fatigue === null ? null : fatigue <= 2 ? 'low' : fatigue <= 3.5 ? 'moderate' : 'high';
  const fatigueColor =
    fatigueLevel === 'low' ? colors.status.success :
    fatigueLevel === 'moderate' ? colors.status.warning : colors.status.danger;

  const [ratings, setRatings] = useState<Record<RatingKey, number>>(
    todayEntry
      ? { mood: todayEntry.mood, energy: todayEntry.energy, stress: todayEntry.stress }
      : { mood: 0, energy: 0, stress: 0 },
  );
  const [sleepInput, setSleepInput] = useState(
    todayEntry?.sleepHours ? String(todayEntry.sleepHours) : '',
  );
  const [saved, setSaved] = useState(!!todayEntry);

  const setRating = (key: RatingKey, val: number) => {
    hapticTap();
    setRatings((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  };

  const handleSave = () => {
    const allSet = Object.values(ratings).every((v) => v > 0);
    if (!allSet) {
      Alert.alert(t('recovery.completeCheckin'), t('recovery.rateAllMetrics'));
      return;
    }
    const sleepHours = sleepInput ? parseFloat(sleepInput) || undefined : undefined;
    saveEntry({ ...ratings, sleepHours });
    setSaved(true);
    const avgScore = Math.round((ratings.mood + ratings.energy + (6 - ratings.stress)) / 3);
    analytics.recoveryRated(avgScore);
    hapticSuccess();
    Alert.alert(t('recovery.savedTitle'), t('recovery.savedBody'));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.pageTitle}>{t('recovery.title')}</Text>
        <Text style={styles.pageSub}>{t('recovery.subtitle')}</Text>
      </View>

      {/* ── Sleep Card (no sensor connected) ── */}
      <View style={styles.sleepCard}>
        <View style={styles.sleepNoDataRow}>
          <Icon icon={MoonStar} size={32} color={colors.violet.primary} strokeWidth={1.5} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sleepNoDataTitle}>{t('recovery.sleepTracking')}</Text>
            <Text style={styles.sleepNoDataSub}>{t('recovery.connectHealthSub', { app: HEALTH_APP })}</Text>
          </View>
        </View>
        <View style={styles.sleepTargetRow}>
          <Text style={styles.sleepTargetLabel}>{t('recovery.sleepTarget')}</Text>
          <View style={styles.sleepTargetBadge}>
            <Text style={styles.sleepTargetVal}>{t('recovery.perNight', { hours: targets.sleepHours })}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.connectBtn}
          onPress={() => Alert.alert(HEALTH_APP, t('profile.healthIntegration', { app: HEALTH_APP }))}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('recovery.connectAppA11y', { app: HEALTH_APP })}
        >
          <Text style={styles.connectBtnText}>{t('recovery.connectApp', { app: HEALTH_APP })}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Sleep & Workout Insight ── */}
      <View style={styles.insightCard}>
        <Text style={styles.insightText}>
          {t('recovery.insightSleep', { hours: targets.sleepHours, time: targets.sleepHours >= 9 ? '9:30 PM' : targets.sleepHours >= 8.5 ? '10:00 PM' : '10:30 PM' })}
        </Text>
        <Text style={styles.insightText}>
          {t('recovery.insightWorkout', { minutes: targets.workoutMinutes, days: targets.workoutDaysPerWeek })}
        </Text>
      </View>

      {/* ── Fatigue Score (Pro) — hidden until 3+ check-ins exist ── */}
      {fatigue !== null && (
        isPro ? (
          <View style={styles.fatigueCard}>
            <View style={[styles.fatigueScoreWrap, { backgroundColor: withAlpha(fatigueColor, 0.12) }]}>
              <Text style={[styles.fatigueScore, { color: fatigueColor }]}>{fatigue}</Text>
              <Text style={styles.fatigueOutOf}>/5</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fatigueTitle}>{t('recovery.fatigueTitle')}</Text>
              <Text style={[styles.fatigueLevel, { color: fatigueColor }]}>{t(`recovery.fatigue_${fatigueLevel}`)}</Text>
              <Text style={styles.fatigueTip}>{t(`recovery.fatigueTip_${fatigueLevel}`)}</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.fatigueCard}
            onPress={() => router.push('/paywall')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${t('recovery.fatigueTitle')}. ${t('common.proFeature')}`}
          >
            <View style={styles.fatigueScoreWrap}>
              <Icon icon={Lock} size="md" color={colors.text.tertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fatigueTitle}>{t('recovery.fatigueTitle')}</Text>
              <Text style={styles.fatigueTip}>{t('recovery.fatigueTeaser')}</Text>
            </View>
            <View style={styles.fatigueProBadge}>
              <Text style={styles.fatigueProText}>{t('common.pro')}</Text>
            </View>
          </TouchableOpacity>
        )
      )}

      {/* ── Daily Check-in ── */}
      <View style={styles.checkinCard}>
        <Text style={styles.checkinTitle}>{t('recovery.howFeeling')}</Text>
        <Text style={styles.checkinSub}>{t('recovery.tapToRate')}</Text>

        <View style={styles.metricsWrap}>
          {METRICS.map((m) => (
            <View key={m.key} style={styles.metricRow}>
              <View style={styles.metricMeta}>
                <Icon icon={m.low} size="sm" color={colors.text.tertiary} />
                <Text style={styles.metricLabel}>{t(m.labelKey)}</Text>
                <Icon icon={m.high} size="sm" color={m.color} />
              </View>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingScaleNum}>1</Text>
                <SegmentMeter
                  count={5}
                  filled={ratings[m.key]}
                  color={m.color}
                  onPressSegment={(i) => setRating(m.key, i + 1)}
                  segmentA11y={(i) => ({
                    label: t('recovery.ratingA11y', { label: t(m.labelKey), n: i + 1 }),
                    role: 'radio',
                    selected: ratings[m.key] === i + 1,
                  })}
                  style={styles.ratingDots}
                />
                <Text style={styles.ratingScaleNum}>5</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Sleep duration input */}
        <View style={styles.sleepInputWrap}>
          <View style={styles.sleepInputRow}>
            <Icon icon={Moon} size="md" color={colors.violet.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sleepInputLabel}>{t('recovery.lastNightSleep')}</Text>
              <Text style={styles.sleepInputSub}>{t('recovery.sleepOptional')}</Text>
            </View>
            <View style={styles.sleepInputField}>
              <TextInput
                style={styles.sleepInputText}
                value={sleepInput}
                onChangeText={(txt) => {
                  // Allow only valid sleep hours (0-24)
                  const parsed = parseFloat(txt);
                  if (txt !== '' && (isNaN(parsed) || parsed < 0 || parsed > 24)) return;
                  setSleepInput(txt);
                  setSaved(false);
                }}
                placeholder="0"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="decimal-pad"
                returnKeyType="done"
                maxLength={4}
              />
              <Text style={styles.sleepInputUnit}>hrs</Text>
            </View>
          </View>
          {sleepInput ? (
            <AnimatedBar
              pct={parseFloat(sleepInput) / targets.sleepHours}
              color={
                parseFloat(sleepInput) >= targets.sleepHours
                  ? colors.status.success
                  : parseFloat(sleepInput) >= targets.sleepHours * 0.8
                  ? colors.status.warning
                  : colors.status.danger
              }
              height={6}
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
          {sleepInput ? (
            <Text style={styles.sleepBarLabel}>
              {parseFloat(sleepInput) >= targets.sleepHours
                ? t('recovery.sleepMet', { hours: targets.sleepHours })
                : t('recovery.sleepShort', { diff: (targets.sleepHours - parseFloat(sleepInput)).toFixed(1), hours: targets.sleepHours })}
            </Text>
          ) : null}
        </View>

        <Button
          variant={saved ? 'success' : 'primary'}
          label={saved ? t('recovery.saved') : t('recovery.saveCheckin')}
          onPress={handleSave}
          accessibilityLabel={saved ? t('recovery.checkinSaved') : t('recovery.saveCheckin')}
          style={{ marginTop: spacing.xl }}
        />
      </View>

      {/* ── Recovery Score (derived from today's ratings) ── */}
      {todayEntry && (() => {
        // mood + energy contribute positively, stress negatively (max 30)
        const ratingRaw = todayEntry.mood * 2 + todayEntry.energy * 2 + (6 - todayEntry.stress) * 2;
        const ratingScore = Math.round((ratingRaw / 30) * 100);

        // Sleep component: if logged, blends 80% ratings + 20% sleep quality
        const sleepH  = todayEntry.sleepHours;
        const sleepPct = sleepH ? Math.min(sleepH / targets.sleepHours, 1) * 100 : null;
        const recoveryScore = sleepPct !== null
          ? Math.round(ratingScore * 0.8 + sleepPct * 0.2)
          : ratingScore;

        const recColor = recoveryScore >= 70 ? colors.status.success : recoveryScore >= 45 ? colors.status.warning : colors.status.danger;
        const subLabel = sleepH
          ? t('recovery.recoverySubWithSleep', { hours: sleepH })
          : t('recovery.recoverySubNoSleep');
        return (
          <View style={styles.recoveryCard}>
            <View style={styles.recoveryLeft}>
              <Icon icon={HeartPulse} size={28} color={colors.accent.primary} strokeWidth={1.5} />
              <View>
                <Text style={styles.recoveryTitle}>{t('recovery.recoveryScore')}</Text>
                <Text style={styles.recoverySub}>{subLabel}</Text>
              </View>
            </View>
            <View style={styles.recoveryScore}>
              <Text style={[styles.recoveryNum, { color: recColor }]}>{recoveryScore}</Text>
              <Text style={styles.recoveryMax}>/100</Text>
            </View>
          </View>
        );
      })()}

      {/* ── AI Coach Banner ── */}
      <AICoachBanner subtitle={t('recovery.aiCoachSubtitle')} style={{ marginTop: spacing.base }} />

      <View style={{ height: 110 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.base },

  header:   { marginBottom: spacing.xl },
  pageTitle: { fontFamily: typography.fonts.display, fontSize: typography.sizes['2xl'], color: colors.text.primary },
  pageSub:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: 2 },

  sleepCard: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: withAlpha(colors.violet.primary, 0.15), borderRadius: radius.xl, padding: spacing.base, marginBottom: spacing.base, ...elevation.card },
  sleepNoDataRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.base, marginBottom: spacing.base },
  sleepNoDataTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.md, color: colors.text.primary, marginBottom: 4 },
  sleepNoDataSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, lineHeight: 20 },
  sleepTargetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base },
  sleepTargetLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary },
  sleepTargetBadge: { backgroundColor: withAlpha(colors.violet.primary, 0.08), borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6 },
  sleepTargetVal: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.violet.primary },
  connectBtn: { backgroundColor: withAlpha(colors.violet.primary, 0.08), borderWidth: 1, borderColor: withAlpha(colors.violet.primary, 0.25), borderRadius: radius.full, paddingVertical: 12, alignItems: 'center' },
  connectBtnText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.violet.primary },

  insightCard: { backgroundColor: colors.accent.dim, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.19), borderRadius: radius.xl, padding: spacing.base, marginBottom: spacing.base },
  insightText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, lineHeight: 20, marginBottom: 6 },
  insightBold: { fontFamily: typography.fonts.bodyMed, color: colors.accent.primary },

  fatigueCard:      { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: withAlpha(colors.violet.primary, 0.19), borderRadius: radius.xl, padding: spacing.base, marginBottom: spacing.base, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, ...elevation.card },
  fatigueScoreWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.bg.elevated, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  fatigueScore:     { fontFamily: typography.fonts.mono, fontSize: typography.sizes.lg },
  fatigueOutOf:     { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },
  fatigueTitle:     { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  fatigueLevel:     { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, marginTop: 1 },
  fatigueTip:       { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: 2, lineHeight: 19 },
  fatigueProBadge:  { backgroundColor: colors.accent.dim, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  fatigueProText:   { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },

  checkinCard:  { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius['2xl'], padding: spacing.base, marginBottom: spacing.base, ...elevation.raised },
  checkinTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.md, color: colors.text.primary, marginBottom: 4 },
  checkinSub:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginBottom: spacing.xl },

  metricsWrap: { gap: spacing.xl },
  metricRow:   { gap: spacing.sm },
  metricMeta:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricLabel: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.secondary },
  ratingRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  ratingScaleNum:  { fontFamily: typography.fonts.mono, fontSize: typography.sizes.xs, color: colors.text.tertiary, width: 14, textAlign: 'center' },
  ratingDots:      { flex: 1 },

  sleepInputWrap:  { marginTop: spacing.xl, backgroundColor: colors.bg.tertiary, borderRadius: radius.lg, padding: spacing.base },
  sleepInputRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sleepInputLabel: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.primary },
  sleepInputSub:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
  sleepInputField: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.25), borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  sleepInputText:  { fontFamily: typography.fonts.mono, fontSize: typography.sizes.lg, color: colors.text.primary, minWidth: 36, textAlign: 'center' },
  sleepInputUnit:  { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },
  sleepBarLabel:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 4 },

  recoveryCard:  { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: withAlpha(colors.status.success, 0.15), borderRadius: radius.xl, padding: spacing.base, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base, ...elevation.card },
  recoveryLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recoveryTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  recoverySub:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
  recoveryScore: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  recoveryNum:   { fontFamily: typography.fonts.mono, fontSize: typography.sizes['2xl'] },
  recoveryMax:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary },
});

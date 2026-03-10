import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useUserStore } from '../../stores/userStore';
import { computeTargets } from '../../services/recommendations';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { AICoachBanner } from '../../components/ui/AICoachBanner';

type RatingKey = 'mood' | 'energy' | 'stress';

const METRICS: { key: RatingKey; label: string; low: string; high: string; color: string }[] = [
  { key: 'mood',   label: 'Mood',   low: '😞', high: '😄', color: colors.status.warning },
  { key: 'energy', label: 'Energy', low: '🪫', high: '⚡', color: colors.accent.primary },
  { key: 'stress', label: 'Stress', low: '😌', high: '😤', color: colors.status.danger },
];

export default function RecoveryScreen() {
  const saveEntry       = useRecoveryStore((s) => s.saveEntry);
  const recoveryEntries = useRecoveryStore((s) => s.entries);
  const profile         = useUserStore((s) => s.profile);
  const targets         = computeTargets(profile);
  const todayStr        = new Date().toISOString().slice(0, 10);
  const todayEntry      = recoveryEntries.find((e) => e.date === todayStr);

  const [ratings, setRatings] = useState<Record<RatingKey, number>>(
    todayEntry
      ? { mood: todayEntry.mood, energy: todayEntry.energy, stress: todayEntry.stress }
      : { mood: 0, energy: 0, stress: 0 },
  );
  const [saved, setSaved] = useState(!!todayEntry);

  const setRating = (key: RatingKey, val: number) => {
    setRatings((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  };

  const handleSave = () => {
    const allSet = Object.values(ratings).every((v) => v > 0);
    if (!allSet) {
      Alert.alert('Complete Check-in', 'Please rate all three metrics before saving.');
      return;
    }
    saveEntry(ratings);
    setSaved(true);
    Alert.alert('Saved!', 'Your daily check-in has been recorded.');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Recovery</Text>
        <Text style={styles.pageSub}>Rest & wellbeing</Text>
      </View>

      {/* ── Sleep Card (no sensor connected) ── */}
      <View style={styles.sleepCard}>
        <View style={styles.sleepNoDataRow}>
          <Text style={{ fontSize: 32 }}>💤</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.sleepNoDataTitle}>Sleep Tracking</Text>
            <Text style={styles.sleepNoDataSub}>Connect Apple Health to see your sleep stages, bedtime & wake time automatically.</Text>
          </View>
        </View>
        <View style={styles.sleepTargetRow}>
          <Text style={styles.sleepTargetLabel}>Your sleep target</Text>
          <View style={styles.sleepTargetBadge}>
            <Text style={styles.sleepTargetVal}>{targets.sleepHours}h / night</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.connectBtn}
          onPress={() => Alert.alert('Apple Health', 'Apple Health integration coming soon.')}
          activeOpacity={0.85}
        >
          <Text style={styles.connectBtnText}>Connect Apple Health →</Text>
        </TouchableOpacity>
      </View>

      {/* ── Sleep & Workout Insight ── */}
      <View style={styles.insightCard}>
        <Text style={styles.insightText}>
          🌙  Your goal needs <Text style={styles.insightBold}>{targets.sleepHours}h of sleep</Text> per night — aim to be in bed by{' '}
          {targets.sleepHours >= 9 ? '9:30 PM' : targets.sleepHours >= 8.5 ? '10:00 PM' : '10:30 PM'}.
        </Text>
        <Text style={styles.insightText}>
          🏋  Target <Text style={styles.insightBold}>{targets.workoutMinutes} min</Text> of exercise,{' '}
          <Text style={styles.insightBold}>{targets.workoutDaysPerWeek}×/week</Text>.
        </Text>
      </View>

      {/* ── Daily Check-in ── */}
      <View style={styles.checkinCard}>
        <Text style={styles.checkinTitle}>How are you feeling today?</Text>
        <Text style={styles.checkinSub}>Tap to rate each metric 1–5</Text>

        <View style={styles.metricsWrap}>
          {METRICS.map((m) => (
            <View key={m.key} style={styles.metricRow}>
              <View style={styles.metricMeta}>
                <Text style={styles.metricLow}>{m.low}</Text>
                <Text style={styles.metricLabel}>{m.label}</Text>
                <Text style={styles.metricHigh}>{m.high}</Text>
              </View>
              <View style={styles.ratingDots}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = ratings[m.key] >= n;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[
                        styles.ratingDot,
                        active
                          ? { backgroundColor: m.color, borderColor: m.color }
                          : { backgroundColor: 'transparent', borderColor: colors.border.default },
                      ]}
                      onPress={() => setRating(m.key, n)}
                      activeOpacity={0.7}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saved && styles.saveBtnDone]}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>{saved ? '✓ Saved' : 'Save Check-in'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Recovery Score (derived from today's ratings) ── */}
      {todayEntry && (() => {
        // mood + energy contribute positively, stress negatively
        const rawScore = (todayEntry.mood * 2 + todayEntry.energy * 2 + (6 - todayEntry.stress) * 2);
        const recoveryScore = Math.round((rawScore / 30) * 100); // max raw = 30
        const recColor = recoveryScore >= 70 ? colors.status.success : recoveryScore >= 45 ? colors.status.warning : colors.status.danger;
        return (
          <View style={styles.recoveryCard}>
            <View style={styles.recoveryLeft}>
              <Text style={{ fontSize: 28 }}>🧘</Text>
              <View>
                <Text style={styles.recoveryTitle}>Recovery Score</Text>
                <Text style={styles.recoverySub}>Based on mood, energy & stress</Text>
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
      <AICoachBanner subtitle="Tips for better sleep & recovery" style={{ marginTop: spacing.base }} />

      <View style={{ height: 110 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.base },

  header:   { paddingTop: 52, marginBottom: spacing.xl },
  pageTitle: { fontFamily: typography.fonts.display, fontSize: typography.sizes['2xl'], color: colors.text.primary },
  pageSub:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: 2 },

  sleepCard: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.violet.primary + '25', borderRadius: radius['2xl'], padding: spacing.base, marginBottom: spacing.base },
  sleepNoDataRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.base, marginBottom: spacing.base },
  sleepNoDataTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.md, color: colors.text.primary, marginBottom: 4 },
  sleepNoDataSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, lineHeight: 20 },
  sleepTargetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base },
  sleepTargetLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary },
  sleepTargetBadge: { backgroundColor: colors.violet.primary + '15', borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6 },
  sleepTargetVal: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.violet.primary },
  connectBtn: { backgroundColor: colors.violet.primary + '15', borderWidth: 1, borderColor: colors.violet.primary + '40', borderRadius: radius.full, paddingVertical: 12, alignItems: 'center' },
  connectBtnText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.violet.primary },

  insightCard: { backgroundColor: colors.accent.dim, borderWidth: 1, borderColor: colors.accent.primary + '30', borderRadius: radius.xl, padding: spacing.base, marginBottom: spacing.base },
  insightText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, lineHeight: 20, marginBottom: 6 },
  insightBold: { fontFamily: typography.fonts.bodyMed, color: colors.accent.primary },

  checkinCard:  { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius['2xl'], padding: spacing.base, marginBottom: spacing.base },
  checkinTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.md, color: colors.text.primary, marginBottom: 4 },
  checkinSub:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginBottom: spacing.xl },

  metricsWrap: { gap: spacing.xl },
  metricRow:   { gap: spacing.sm },
  metricMeta:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricLow:   { fontSize: 16 },
  metricLabel: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.secondary },
  metricHigh:  { fontSize: 16 },
  ratingDots:  { flexDirection: 'row', gap: spacing.sm },
  ratingDot:   { flex: 1, height: 10, borderRadius: 5, borderWidth: 1.5 },

  saveBtn:     { backgroundColor: colors.accent.primary, borderRadius: radius.full, paddingVertical: 14, alignItems: 'center', marginTop: spacing.xl },
  saveBtnDone: { backgroundColor: colors.status.success },
  saveBtnText: { fontFamily: typography.fonts.display, fontSize: typography.sizes.base, color: colors.text.inverse },

  recoveryCard:  { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.status.success + '25', borderRadius: radius.xl, padding: spacing.base, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base },
  recoveryLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recoveryTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  recoverySub:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
  recoveryScore: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  recoveryNum:   { fontFamily: typography.fonts.display, fontSize: typography.sizes['2xl'] },
  recoveryMax:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary },
});

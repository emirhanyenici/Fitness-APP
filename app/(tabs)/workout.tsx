import { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Pressable, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { useUserStore } from '../../stores/userStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useAISuggestionsStore } from '../../stores/aiSuggestionsStore';
import { useExerciseWeightStore, suggestWeight } from '../../stores/exerciseWeightStore';
import { WorkoutExercise } from '../../services/exercisedb';
import { computeTargets, GOAL_LABELS } from '../../services/recommendations';
import { getTodayPlan, recommendProgram, PROGRAMS } from '../../services/workoutPrograms';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { useAnalytics } from '../../services/analytics';
import { AICoachBanner } from '../../components/ui/AICoachBanner';

function formatWorkoutDate(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

export default function WorkoutScreen() {
  const isPro = useSubscriptionStore((s) => s.isPro);
  const profile = useUserStore((s) => s.profile);
  const primaryGoal = profile?.primary_goal ?? 'general_health';
  const selectedType = useWorkoutStore((s) => s.selectedType);
  const selectedProgram = useWorkoutStore((s) => s.selectedProgram);
  const history = useWorkoutStore((s) => s.history);
  const addWorkout = useWorkoutStore((s) => s.addWorkout);
  const aiWorkout  = useAISuggestionsStore((s) => s.workout);
  const clearAI    = useAISuggestionsStore((s) => s.clear);
  const analytics = useAnalytics();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayAISuggestion = aiWorkout?.date === today ? aiWorkout : null;
  const targets = computeTargets(profile);

  const [started, setStarted] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  // exerciseName → weight text entered by user (kg)
  const [weights, setWeights] = useState<Record<string, string>>({});

  const getLastWeight = useExerciseWeightStore((s) => s.getLastWeight);
  const logWeight     = useExerciseWeightStore((s) => s.logWeight);

  const bodyWeight    = profile?.weight_kg ?? 70;
  const gender        = (profile?.gender ?? 'male') as 'male' | 'female' | 'other';
  const freqStr       = profile?.workout_frequency ?? '3';
  const frequency     = parseInt(freqStr) || 3;

  const getAISuggest = (ex: WorkoutExercise): number => {
    const last = getLastWeight(ex.name);
    if (last !== null) return last; // Use last logged weight as base
    return suggestWeight(ex.equipment, ex.muscle, bodyWeight, gender, frequency);
  };

  const setWeight = (name: string, val: string) =>
    setWeights((prev) => ({ ...prev, [name]: val }));

  const isRestDay = selectedType === 'rest';

  // Determine which program to use
  const programType = selectedProgram ?? recommendProgram(primaryGoal, targets.workoutDaysPerWeek);
  const programInfo = PROGRAMS.find(p => p.id === programType) ?? PROGRAMS[0];

  // Get today's plan based on program, day of week, and user's equipment environment
  const dayOfWeek = new Date().getDay();
  const env = (profile?.workout_environment ?? 'gym') as 'gym' | 'home';
  const todayPlan = useMemo(
    () => getTodayPlan(programType, dayOfWeek, 6, env),
    [programType, dayOfWeek, env]
  );

  const exercises: WorkoutExercise[] = todayPlan.exercises;

  const toggleCheck = (name: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleStart = () => {
    setStarted(true);
    analytics.workoutStarted(todayPlan.muscleGroup, programType);
    Alert.alert('Workout Started!', 'Check off exercises as you complete them.');
  };

  const handleFinish = () => {
    analytics.workoutFinished(checked.size, exercises.length);

    // MET-based estimate: calories = MET × weight_kg × (duration_min / 60) × completion_ratio
    const MET_BY_GROUP: Record<string, number> = {
      cardio: 8, chest: 5, back: 5, legs: 6, shoulders: 4, arms: 4, core: 5,
    };
    const weight      = profile?.weight_kg ?? 70;
    const durationMin = parseInt(todayPlan.duration) || 45;
    const met         = MET_BY_GROUP[todayPlan.muscleGroup?.toLowerCase() ?? ''] ?? 5;
    const ratio       = exercises.length > 0 ? checked.size / exercises.length : 0;
    const estCals     = Math.round(met * weight * (durationMin / 60) * ratio);
    // Persist exercise weights
    const exerciseWeights: Record<string, number> = {};
    exercises.forEach((ex) => {
      const raw = parseFloat(weights[ex.name] ?? '');
      const kg  = isNaN(raw) ? 0 : raw;
      exerciseWeights[ex.name] = kg;
      if (kg > 0) logWeight(ex.name, kg);
    });

    addWorkout({
      name: `${programInfo.name} — ${todayPlan.dayLabel}`,
      icon: programInfo.icon,
      bodyPart: todayPlan.muscleGroup,
      duration: todayPlan.duration,
      calories: estCals,
      exercisesDone: checked.size,
      exercisesTotal: exercises.length,
      exerciseWeights,
    });

    setStarted(false);
    setChecked(new Set());
    setWeights({});
    Alert.alert('Workout Complete! 🎉', `Great job! You completed ${checked.size} of ${exercises.length} exercises.`);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Workout</Text>
          <Text style={styles.pageSub}>{GOAL_LABELS[primaryGoal] ?? 'Healthy Lifestyle'} · {targets.workoutDaysPerWeek}×/week</Text>
        </View>
        <TouchableOpacity
          style={styles.logBtn}
          onPress={() => router.push('/modals/log-workout')}
          activeOpacity={0.8}
        >
          <Text style={styles.logBtnText}>Change</Text>
        </TouchableOpacity>
      </View>

      {/* ── Personalized Info Strip ── */}
      <View style={styles.insightStrip}>
        <View style={styles.insightChip}>
          <Text style={styles.insightVal}>{targets.workoutDaysPerWeek}×</Text>
          <Text style={styles.insightLbl}>per week</Text>
        </View>
        <View style={styles.insightDiv} />
        <View style={styles.insightChip}>
          <Text style={styles.insightVal}>{todayPlan.duration}</Text>
          <Text style={styles.insightLbl}>duration</Text>
        </View>
        <View style={styles.insightDiv} />
        <View style={styles.insightChip}>
          <Text style={styles.insightVal}>{todayPlan.intensity}</Text>
          <Text style={styles.insightLbl}>intensity</Text>
        </View>
        <View style={styles.insightDiv} />
        <View style={styles.insightChip}>
          <Text style={[styles.insightVal, { fontSize: typography.sizes.xs }]}>{programInfo.name}</Text>
          <Text style={styles.insightLbl}>program</Text>
        </View>
      </View>

      {/* ── AI Coach Banner ── */}
      <AICoachBanner subtitle="Get a personalized workout plan" />

      {/* ── AI Workout Suggestion ── */}
      {todayAISuggestion && (
        <View style={styles.aiSuggestCard}>
          <View style={styles.aiSuggestHeader}>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>✦ AI Workout Plan</Text>
            </View>
            <TouchableOpacity onPress={() => clearAI('workout')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.aiClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.aiSuggestText}>{todayAISuggestion.text}</Text>
        </View>
      )}

      {/* ── Rest Day ── */}
      {isRestDay ? (
        <View style={styles.restCard}>
          <Text style={{ fontSize: 48 }}>😴</Text>
          <Text style={styles.restTitle}>Rest Day</Text>
          <Text style={styles.restSub}>Recovery is part of progress. Stay hydrated and get good sleep tonight.</Text>
          <TouchableOpacity style={styles.startBtn} onPress={() => router.push('/modals/log-workout')} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>Choose a Workout Instead</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ── Today's Plan ── */
        <View style={styles.aiCard}>
          <View style={styles.aiCardTop}>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>✦ {todayPlan.dayLabel}</Text>
            </View>
            {isPro && <Text style={styles.proTag}>PRO</Text>}
          </View>

          <Text style={styles.workoutName}>{todayPlan.muscleGroup}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaChip}><Text style={styles.metaText}>⏱ {todayPlan.duration}</Text></View>
            <View style={styles.metaChip}><Text style={styles.metaText}>🔥 {todayPlan.intensity}</Text></View>
            <View style={styles.metaChip}><Text style={styles.metaText}>💪 {exercises.length} exercises</Text></View>
          </View>

          <View style={styles.exerciseList}>
            {exercises.map((ex, i) => {
              const done      = checked.has(ex.name);
              const lastW     = getLastWeight(ex.name);
              const suggested = getAISuggest(ex);
              const isBodywt  = ex.equipment === 'bodyweight';
              return (
                <View
                  key={ex.name + i}
                  style={[styles.exerciseRow, i === exercises.length - 1 && { borderBottomWidth: 0 }]}
                >
                  {/* Check / tap */}
                  <TouchableOpacity
                    onPress={() => {
                      if (started) toggleCheck(ex.name);
                      else Alert.alert('Workout not started', "Tap 'Start Workout →' to begin tracking your exercises.");
                    }}
                    activeOpacity={0.7}
                    style={styles.exCheckWrap}
                  >
                    <View style={[styles.exCheck, done && styles.exCheckDone]}>
                      {done && <Text style={{ fontSize: 10, color: colors.text.inverse }}>✓</Text>}
                    </View>
                  </TouchableOpacity>

                  <View style={styles.exBody}>
                    {/* Top row: name + sets/rest */}
                    <View style={styles.exTopRow}>
                      <View style={styles.exInfo}>
                        <Text style={[styles.exName, done && styles.exNameDone]}>{ex.name}</Text>
                        <View style={styles.exMuscleRow}>
                          <Text style={styles.exMuscle}>{ex.muscle}</Text>
                          <Pressable
                            style={styles.demoBtn}
                            onPress={() => router.push({
                              pathname: '/modals/exercise-demo',
                              params: { name: ex.name, muscle: ex.muscle },
                            })}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Text style={styles.demoBtnText}>▶ Demo</Text>
                          </Pressable>
                        </View>
                      </View>
                      <View style={styles.exMeta}>
                        <Text style={styles.exSets}>{ex.sets} × {ex.reps}</Text>
                        <Text style={styles.exRest}>rest {ex.rest}</Text>
                      </View>
                    </View>

                    {/* Weight row — only when workout is started and not bodyweight */}
                    {started && !isBodywt && (
                      <View style={styles.weightRow}>
                        <Text style={styles.weightIcon}>🏋️</Text>
                        <TextInput
                          style={styles.weightInput}
                          value={weights[ex.name] ?? ''}
                          onChangeText={(v) => setWeight(ex.name, v)}
                          placeholder={lastW !== null ? `${lastW} kg` : `~${suggested} kg`}
                          placeholderTextColor={colors.text.tertiary}
                          keyboardType="decimal-pad"
                          returnKeyType="done"
                          maxLength={6}
                        />
                        <Text style={styles.weightUnit}>kg</Text>
                        <TouchableOpacity
                          style={styles.aiWeightBtn}
                          onPress={() => setWeight(ex.name, String(suggested))}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Text style={styles.aiWeightBtnText}>✦ AI</Text>
                        </TouchableOpacity>
                        {lastW !== null && (
                          <View style={styles.prBadge}>
                            <Text style={styles.prBadgeText}>Last: {lastW}kg</Text>
                          </View>
                        )}
                      </View>
                    )}
                    {started && isBodywt && (
                      <View style={styles.weightRow}>
                        <Text style={styles.bodywt}>Bodyweight</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {!started ? (
            <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
              <Text style={styles.startBtnText}>Start Workout →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.finishBtn} onPress={handleFinish} activeOpacity={0.85}>
              <Text style={styles.finishBtnText}>
                Finish  ({checked.size}/{exercises.length} done)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Change workout ── */}
      <TouchableOpacity style={styles.logDiffRow} onPress={() => router.push('/modals/log-workout')} activeOpacity={0.75}>
        <Text style={styles.logDiffText}>Switch program or take a rest day</Text>
        <Text style={styles.logDiffArrow}>›</Text>
      </TouchableOpacity>

      {/* ── Recent Workouts ── */}
      <Text style={styles.sectionTitle}>Recent Workouts</Text>
      <View style={styles.recentList}>
        {history.length > 0 ? (
          history.slice(0, 10).map((w) => {
            const weightEntries = Object.entries(w.exerciseWeights ?? {}).filter(([, kg]) => kg > 0);
            return (
              <View key={w.id} style={styles.recentRow}>
                <View style={styles.recentIcon}><Text style={{ fontSize: 22 }}>{w.icon}</Text></View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName}>{w.name}</Text>
                  <Text style={styles.recentDate}>{formatWorkoutDate(w.date)}  ·  {w.duration}  ·  {w.exercisesDone}/{w.exercisesTotal}</Text>
                  {weightEntries.length > 0 && (
                    <View style={styles.recentWeights}>
                      {weightEntries.slice(0, 3).map(([name, kg]) => (
                        <View key={name} style={styles.recentWeightChip}>
                          <Text style={styles.recentWeightText}>{name.split(' ')[0]} {kg}kg</Text>
                        </View>
                      ))}
                      {weightEntries.length > 3 && (
                        <Text style={styles.recentWeightMore}>+{weightEntries.length - 3}</Text>
                      )}
                    </View>
                  )}
                </View>
                <Text style={styles.recentCals}>{w.calories} kcal</Text>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 36 }}>🏋️</Text>
            <Text style={styles.emptyTitle}>No workouts yet</Text>
            <Text style={styles.emptySub}>Complete your first workout and it'll show up here!</Text>
          </View>
        )}
      </View>

      <View style={{ height: 110 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.base },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 52, marginBottom: spacing.xl },
  pageTitle: { fontFamily: typography.fonts.display, fontSize: typography.sizes['2xl'], color: colors.text.primary },
  pageSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: 2 },
  logBtn: { backgroundColor: colors.accent.dim, borderWidth: 1, borderColor: colors.accent.primary + '40', borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 8 },
  logBtnText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.accent.primary },

  insightStrip: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.accent.primary + '20', borderRadius: radius.xl, padding: spacing.base, flexDirection: 'row', alignItems: 'center', marginBottom: spacing.base },
  insightChip: { flex: 1, alignItems: 'center', gap: 2 },
  insightVal: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.md, color: colors.accent.primary },
  insightLbl: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },
  insightDiv: { width: 1, height: 28, backgroundColor: colors.border.subtle },

  restCard: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius['2xl'], padding: spacing['2xl'], alignItems: 'center', gap: spacing.base, marginBottom: spacing.sm },
  restTitle: { fontFamily: typography.fonts.display, fontSize: typography.sizes['2xl'], color: colors.text.primary },
  restSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.base, color: colors.text.secondary, textAlign: 'center', lineHeight: 22 },

  aiCard: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.accent.primary + '20', borderRadius: radius['2xl'], padding: spacing.base, marginBottom: spacing.sm, shadowColor: 'rgba(15,23,42,1)', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  aiCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  aiBadge: { backgroundColor: colors.accent.dim, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  aiBadgeText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },
  proTag: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },

  workoutName: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.xl, color: colors.text.primary, marginBottom: spacing.sm },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  metaChip: { backgroundColor: colors.bg.elevated, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  metaText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.secondary },

  exerciseList: { borderTopWidth: 1, borderTopColor: colors.border.subtle, marginBottom: spacing.base },
  exerciseRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border.subtle, gap: spacing.sm },
  exCheckWrap: { paddingTop: 2 },
  exCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border.default, alignItems: 'center', justifyContent: 'center' },
  exCheckDone: { backgroundColor: colors.status.success, borderColor: colors.status.success },
  exBody: { flex: 1, gap: 6 },
  exTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  exInfo: { flex: 1 },
  exName: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.primary },
  exNameDone: { color: colors.text.tertiary, textDecorationLine: 'line-through' },
  exMuscleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  exMuscle:    { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },
  demoBtn:     { backgroundColor: colors.accent.dim, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  demoBtnText: { fontFamily: typography.fonts.bodyMed, fontSize: 10, color: colors.accent.primary },
  exMeta: { alignItems: 'flex-end' },
  exSets: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.primary },
  exRest: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },

  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  weightIcon: { fontSize: 13 },
  weightInput: {
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: colors.accent.primary + '50',
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: colors.text.primary,
    fontFamily: typography.fonts.bodyMed,
    fontSize: typography.sizes.sm,
    minWidth: 64,
    textAlign: 'center',
  },
  weightUnit: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },
  aiWeightBtn: { backgroundColor: colors.accent.dim, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.accent.primary + '40' },
  aiWeightBtnText: { fontFamily: typography.fonts.bodyMed, fontSize: 10, color: colors.accent.primary },
  prBadge: { backgroundColor: colors.bg.elevated, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  prBadgeText: { fontFamily: typography.fonts.body, fontSize: 10, color: colors.text.tertiary },
  bodywt: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, fontStyle: 'italic' },

  startBtn: { backgroundColor: colors.accent.primary, borderRadius: radius.full, paddingVertical: 14, alignItems: 'center' },
  startBtnText: { fontFamily: typography.fonts.display, fontSize: typography.sizes.base, color: colors.text.inverse },
  finishBtn: { backgroundColor: colors.status.success, borderRadius: radius.full, paddingVertical: 14, alignItems: 'center' },
  finishBtnText: { fontFamily: typography.fonts.display, fontSize: typography.sizes.base, color: colors.text.inverse },

  logDiffRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.base, marginBottom: spacing.sm },
  logDiffText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.base, color: colors.text.secondary },
  logDiffArrow: { fontFamily: typography.fonts.body, fontSize: typography.sizes.lg, color: colors.text.tertiary },

  sectionTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary, marginBottom: spacing.sm },

  recentList: { gap: spacing.sm },
  recentRow: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.base, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recentIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg.elevated, alignItems: 'center', justifyContent: 'center' },
  recentInfo: { flex: 1 },
  recentName: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  recentDate: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
  recentCals: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.secondary },
  recentWeights: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  recentWeightChip: { backgroundColor: colors.accent.dim, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  recentWeightText: { fontFamily: typography.fonts.body, fontSize: 10, color: colors.accent.primary },
  recentWeightMore: { fontFamily: typography.fonts.body, fontSize: 10, color: colors.text.tertiary, alignSelf: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: spacing['2xl'], gap: spacing.sm },
  emptyTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.secondary },
  emptySub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary, textAlign: 'center' },

  aiSuggestCard:   { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.accent.primary + '30', borderRadius: radius.xl, padding: spacing.base, marginBottom: spacing.base },
  aiSuggestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  aiBadge:         { backgroundColor: colors.accent.dim, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  aiBadgeText:     { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },
  aiClose:         { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary },
  aiSuggestText:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.primary, lineHeight: 20 },
});

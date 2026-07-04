import { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Pressable, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { useUserStore } from '../../stores/userStore';
import { useWorkoutStore, CompletedWorkout } from '../../stores/workoutStore';
import { useAISuggestionsStore } from '../../stores/aiSuggestionsStore';
import { useExerciseWeightStore, suggestWeight } from '../../stores/exerciseWeightStore';
import { WorkoutExercise } from '../../services/exercisedb';
import { computeTargets, GOAL_LABELS } from '../../services/recommendations';
import { getTodayPlan, recommendProgram, PROGRAMS, ProgramType } from '../../services/workoutPrograms';
import { todayStr, daysAgoStr } from '../../services/dateUtils';
import { colors, withAlpha } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { elevation } from '../../constants/elevation';
import { useAnalytics } from '../../services/analytics';
import { AICoachBanner } from '../../components/ui/AICoachBanner';
import { Button } from '../../components/ui/Button';
import { hapticTap, hapticSuccess } from '../../services/haptics';
import { useCustomProgramStore } from '../../stores/customProgramStore';
import { useT } from '../../constants/i18n';
import {
  Icon, workoutIcon, X, NotebookPen, Bed, Sparkles, Timer, Flame, Dumbbell,
  Check, ChevronRight,
} from '../../components/ui/Icon';

function formatWorkoutDate(dateStr: string): string {
  const today = todayStr();
  const yesterday = daysAgoStr(1);
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

/** Merge multiple workouts from the same day into one summary entry */
function groupByDate(history: CompletedWorkout[]): CompletedWorkout[] {
  const map = new Map<string, CompletedWorkout>();
  for (const w of history) {
    const existing = map.get(w.date);
    if (!existing) {
      map.set(w.date, { ...w, exerciseWeights: { ...w.exerciseWeights } });
    } else {
      const isSamePlan = existing.name === w.name;
      existing.calories += w.calories;
      const merged = { ...existing.exerciseWeights };
      for (const [name, kg] of Object.entries(w.exerciseWeights ?? {})) {
        if (kg > 0) merged[name] = kg;
      }
      existing.exerciseWeights = merged;

      if (isSamePlan) {
        // Same plan repeated — cap done at plan size, keep total fixed
        existing.exercisesDone  = Math.min(existing.exercisesDone + w.exercisesDone, existing.exercisesTotal);
      } else {
        // Different plan — accumulate both counts
        existing.exercisesDone  += w.exercisesDone;
        existing.exercisesTotal += w.exercisesTotal;
        // Use the stored dayLabel; fall back to legacy string-parse for old records.
        const dayPart = w.dayLabel ?? w.name.split('—')[1]?.trim() ?? w.name;
        existing.name = existing.name + ' + ' + dayPart;
      }
    }
  }
  return Array.from(map.values());
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
  const t = useT();

  // Compute today fresh each render — prevents stale date after midnight
  const today = todayStr();
  const todayAISuggestion = aiWorkout?.date === today ? aiWorkout : null;
  const targets = useMemo(() => computeTargets(profile), [profile]);

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
  const isImperial    = profile?.units === 'imperial';
  const weightUnit    = isImperial ? 'lbs' : 'kg';
  // Convert stored kg → display unit
  const toDisplay = (kg: number) => isImperial ? Math.round(kg * 2.20462 * 10) / 10 : kg;
  // Convert display unit → stored kg
  const fromDisplay = (val: number) => isImperial ? Math.round((val / 2.20462) * 100) / 100 : val;

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

  // Custom program store
  const customDays = useCustomProgramStore((s) => s.days);

  // Get today's plan based on program, day of week, and user's equipment environment
  const dayOfWeek = new Date().getDay();
  const env = (profile?.workout_environment ?? 'gym') as 'gym' | 'home';

  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const todayPlan = useMemo(() => {
    if (programType === 'custom') {
      // Try today first
      const todayCustom = customDays[dayOfWeek];
      if (todayCustom && todayCustom.exercises.length > 0) {
        const exs = todayCustom.exercises;
        return { dayLabel: DAY_SHORT[dayOfWeek], muscleGroup: 'Custom Plan', exercises: exs, intensity: 'Custom', duration: `~${exs.length * 5} min` };
      }
      // Today not configured — find next scheduled day (circular)
      const configuredDays = Object.entries(customDays)
        .filter(([, d]) => d.exercises.length > 0)
        .map(([k]) => parseInt(k))
        .sort((a, b) => a - b);
      if (configuredDays.length > 0) {
        const next = configuredDays.find(d => d > dayOfWeek) ?? configuredDays[0];
        const exs  = customDays[next].exercises;
        return { dayLabel: DAY_SHORT[next], muscleGroup: 'Custom Plan', exercises: exs, intensity: 'Custom', duration: `~${exs.length * 5} min` };
      }
      return { dayLabel: DAY_SHORT[dayOfWeek], muscleGroup: 'Custom Plan', exercises: [], intensity: 'Custom', duration: '—' };
    }
    return getTodayPlan(programType, dayOfWeek, 6, env);
  }, [programType, dayOfWeek, env, customDays]);

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
    Alert.alert(t('workout.startedTitle'), t('workout.startedBody'));
  };

  const handleFinish = () => {
    analytics.workoutFinished(checked.size, exercises.length);

    // MET-based estimate: calories = MET × weight_kg × (duration_min / 60) × completion_ratio
    // Keyed on the stable ProgramType, not the free-text muscleGroup label
    // (which never matched the old lowercase keys and always fell back to 5).
    const MET_BY_PROGRAM: Record<ProgramType, number> = {
      full_body: 6, upper_lower: 5, push_pull_legs: 5, bro_split: 5,
      cardio_core: 8, flexibility: 3, custom: 5,
    };
    const weight      = profile?.weight_kg ?? 70;
    const durationMin = parseInt(todayPlan.duration) || 45;
    const met         = MET_BY_PROGRAM[programType] ?? 5;
    const ratio       = exercises.length > 0 ? checked.size / exercises.length : 0;
    const estCals     = Math.round(met * weight * (durationMin / 60) * ratio);
    // Persist exercise weights (always stored as kg)
    const exerciseWeights: Record<string, number> = {};
    exercises.forEach((ex) => {
      const raw = parseFloat(weights[ex.name] ?? '');
      const kg  = isNaN(raw) ? 0 : fromDisplay(raw);
      if (kg > 0) exerciseWeights[ex.name] = kg;
      if (kg > 0) logWeight(ex.name, kg);
    });

    addWorkout({
      name: `${programInfo.name} — ${todayPlan.dayLabel}`,
      programName: programInfo.name,
      dayLabel: todayPlan.dayLabel,
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
    hapticSuccess();
    Alert.alert(t('workout.completeTitle'), t('workout.completeBody', { done: checked.size, total: exercises.length }));
  };

  const showStickyBtn = !isRestDay && !(programType === 'custom' && exercises.length === 0);

  return (
    <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>{t('workout.title')}</Text>
          <Text style={styles.pageSub}>{t('workout.subtitle', { goal: GOAL_LABELS[primaryGoal] ?? t('home.healthyLifestyle'), days: targets.workoutDaysPerWeek })}</Text>
        </View>
        <TouchableOpacity
          style={styles.logBtn}
          onPress={() => router.push('/modals/log-workout')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('workout.changeProgram')}
        >
          <Text style={styles.logBtnText}>{t('workout.change')}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Personalized Info Strip ── */}
      <View style={styles.insightStrip}>
        <View style={styles.insightChip}>
          <Text style={styles.insightVal}>{targets.workoutDaysPerWeek}×</Text>
          <Text style={styles.insightLbl}>{t('workout.perWeek')}</Text>
        </View>
        <View style={styles.insightDiv} />
        <View style={styles.insightChip}>
          <Text style={styles.insightVal}>{todayPlan.duration}</Text>
          <Text style={styles.insightLbl}>{t('workout.duration')}</Text>
        </View>
        <View style={styles.insightDiv} />
        <View style={styles.insightChip}>
          <Text style={styles.insightVal}>{todayPlan.intensity}</Text>
          <Text style={styles.insightLbl}>{t('workout.intensity')}</Text>
        </View>
        <View style={styles.insightDiv} />
        <View style={styles.insightChip}>
          <Text style={[styles.insightVal, { fontSize: typography.sizes.xs }]}>{programInfo.name}</Text>
          <Text style={styles.insightLbl}>{t('workout.program')}</Text>
        </View>
      </View>

      {/* ── AI Coach Banner ── */}
      <AICoachBanner subtitle={t('workout.aiCoachSubtitle')} />

      {/* ── AI Workout Suggestion ── */}
      {todayAISuggestion && (
        <View style={styles.aiSuggestCard}>
          <View style={styles.aiSuggestHeader}>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>{t('workout.aiWorkoutPlan')}</Text>
            </View>
            <TouchableOpacity
              onPress={() => clearAI('workout')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('workout.dismissAiPlan')}
            >
              <Icon icon={X} size="sm" color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.aiSuggestText}>{todayAISuggestion.text}</Text>
        </View>
      )}

      {/* ── Custom Program Empty State ── */}
      {programType === 'custom' && exercises.length === 0 && !isRestDay && (
        <View style={styles.restCard}>
          <Icon icon={NotebookPen} size={48} color={colors.accent.primary} strokeWidth={1.5} />
          <Text style={styles.restTitle}>{t('workout.customProgram')}</Text>
          <Text style={styles.restSub}>{t('workout.customEmpty', { day: DAY_SHORT[dayOfWeek] })}</Text>
          <Button
            label={t('workout.setUpTodayBtn')}
            onPress={() => router.push('/modals/custom-program')}
            accessibilityLabel={t('workout.setUpToday')}
            style={styles.restCardBtn}
          />
        </View>
      )}

      {/* ── Rest Day ── */}
      {isRestDay ? (
        <View style={styles.restCard}>
          <Icon icon={Bed} size={48} color={colors.violet.primary} strokeWidth={1.5} />
          <Text style={styles.restTitle}>{t('workout.restDay')}</Text>
          <Text style={styles.restSub}>{t('workout.restDaySub')}</Text>
          <Button
            label={t('workout.chooseWorkoutInsteadBtn')}
            onPress={() => router.push('/modals/log-workout')}
            accessibilityLabel={t('workout.chooseWorkoutInstead')}
            style={styles.restCardBtn}
          />
        </View>
      ) : programType === 'custom' && exercises.length === 0 ? null : (
        /* ── Today's Plan ── */
        <View style={styles.aiCard}>
          <View style={styles.aiCardTop}>
            <View style={[styles.aiBadge, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
              <Icon icon={Sparkles} size={12} color={colors.accent.primary} />
              <Text style={styles.aiBadgeText}>{todayPlan.dayLabel}</Text>
            </View>
            {isPro && <Text style={styles.proTag}>PRO</Text>}
          </View>

          <Text style={styles.workoutName}>{todayPlan.muscleGroup}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaChip}><Icon icon={Timer} size="sm" color={colors.text.secondary} /><Text style={styles.metaText}>{todayPlan.duration}</Text></View>
            <View style={styles.metaChip}><Icon icon={Flame} size="sm" color={colors.text.secondary} /><Text style={styles.metaText}>{todayPlan.intensity}</Text></View>
            <View style={styles.metaChip}><Icon icon={Dumbbell} size="sm" color={colors.text.secondary} /><Text style={styles.metaText}>{t('workout.exercisesCount', { n: exercises.length })}</Text></View>
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
                      if (started) { hapticTap(); toggleCheck(ex.name); }
                      else Alert.alert(t('workout.workoutNotStarted'), t('workout.tapStartToTrack'));
                    }}
                    activeOpacity={0.7}
                    style={styles.exCheckWrap}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done, disabled: !started }}
                    accessibilityLabel={t('workout.exerciseState', { name: ex.name, state: done ? t('workout.completed') : t('workout.notCompleted') })}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <View style={[styles.exCheck, done && styles.exCheckDone]}>
                      {done && <Icon icon={Check} size={12} color={colors.text.inverse} strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>

                  <View style={styles.exBody}>
                    {/* Top row: name + sets/rest */}
                    <View style={styles.exTopRow}>
                      <View style={styles.exInfo}>
                        <Text style={[styles.exName, done && styles.exNameDone]}>{ex.name}</Text>
                        <Text style={styles.exMuscle}>{ex.muscle}</Text>
                      </View>
                      <View style={styles.exMeta}>
                        <Text style={styles.exSets}>{ex.sets} × {ex.reps}</Text>
                        <Text style={styles.exRest}>{t('workout.restLabel', { rest: ex.rest })}</Text>
                      </View>
                    </View>
                    {/* Demo button on its own row */}
                    <Pressable
                      style={styles.demoBtn}
                      onPress={() => router.push({
                        pathname: '/modals/exercise-demo',
                        params: { name: ex.name, muscle: ex.muscle },
                      })}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={t('workout.watchDemoA11y', { name: ex.name })}
                    >
                      <Text style={styles.demoBtnText}>{t('workout.watchDemo')}</Text>
                    </Pressable>

                    {/* Weight row — only when workout is started and not bodyweight */}
                    {started && !isBodywt && (
                      <View style={styles.weightRow}>
                        <Icon icon={Dumbbell} size="sm" color={colors.text.secondary} />
                        <TextInput
                          style={styles.weightInput}
                          value={weights[ex.name] ?? ''}
                          onChangeText={(v) => setWeight(ex.name, v)}
                          placeholder={lastW !== null ? `${toDisplay(lastW)} ${weightUnit}` : `~${toDisplay(suggested)} ${weightUnit}`}
                          placeholderTextColor={colors.text.tertiary}
                          keyboardType="decimal-pad"
                          returnKeyType="done"
                          maxLength={6}
                        />
                        <Text style={styles.weightUnit}>{weightUnit}</Text>
                        <TouchableOpacity
                          style={styles.aiWeightBtn}
                          onPress={() => setWeight(ex.name, String(toDisplay(suggested)))}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel={t('workout.useAiWeight', { name: ex.name })}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Icon icon={Sparkles} size={11} color={colors.accent.primary} />
                            <Text style={styles.aiWeightBtnText}>AI</Text>
                          </View>
                        </TouchableOpacity>
                        {lastW !== null && (
                          <View style={styles.prBadge}>
                            <Text style={styles.prBadgeText}>{t('workout.last', { weight: toDisplay(lastW), unit: weightUnit })}</Text>
                          </View>
                        )}
                      </View>
                    )}
                    {started && isBodywt && (
                      <View style={styles.weightRow}>
                        <Text style={styles.bodywt}>{t('workout.bodyweight')}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

        </View>
      )}

      {/* ── Change workout ── */}
      <TouchableOpacity
        style={styles.logDiffRow}
        onPress={() => router.push('/modals/log-workout')}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={t('workout.switchProgram')}
      >
        <Text style={styles.logDiffText}>{t('workout.switchProgram')}</Text>
        <Icon icon={ChevronRight} size="sm" color={colors.text.tertiary} />
      </TouchableOpacity>

      {/* ── Recent Workouts ── */}
      <Text style={styles.sectionTitle}>{t('workout.recentWorkouts')}</Text>
      <View style={styles.recentList}>
        {history.length > 0 ? (
          groupByDate(history).slice(0, 10).map((w) => {
            const weightEntries = Object.entries(w.exerciseWeights ?? {}).filter(([, kg]) => kg > 0);
            return (
              <View key={w.id} style={styles.recentRow}>
                <View style={styles.recentIcon}><Icon icon={workoutIcon(w.icon)} size="md" color={colors.accent.primary} /></View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName}>{w.name}</Text>
                  <Text style={styles.recentDate}>{formatWorkoutDate(w.date)}  ·  {w.duration}  ·  {w.exercisesDone}/{w.exercisesTotal}</Text>
                  {weightEntries.length > 0 && (
                    <View style={styles.recentWeights}>
                      {weightEntries.slice(0, 3).map(([name, kg]) => (
                        <View key={name} style={styles.recentWeightChip}>
                          <Text style={styles.recentWeightText}>{name.split(' ')[0]} {toDisplay(kg)}{weightUnit}</Text>
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
            <Icon icon={Dumbbell} size={36} color={colors.text.tertiary} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>{t('workout.noWorkouts')}</Text>
            <Text style={styles.emptySub}>{t('workout.noWorkoutsSub')}</Text>
          </View>
        )}
      </View>

      <View style={{ height: showStickyBtn ? 130 : 110 }} />
    </ScrollView>

    {/* ── Sticky Start / Finish ── */}
    {showStickyBtn && (
      <View style={styles.stickyFooter}>
        {!started ? (
          <Button
            label={t('workout.startWorkoutBtn')}
            onPress={handleStart}
            accessibilityLabel={t('workout.startWorkout')}
          />
        ) : (
          <Button
            variant="success"
            label={t('workout.finishBtn', { done: checked.size, total: exercises.length })}
            onPress={handleFinish}
            accessibilityLabel={t('workout.finishWorkoutA11y', { done: checked.size, total: exercises.length })}
          />
        )}
      </View>
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.base },
  stickyFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.bg.primary, paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: 26, borderTopWidth: 1, borderTopColor: colors.border.subtle },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 52, marginBottom: spacing.xl },
  pageTitle: { fontFamily: typography.fonts.display, fontSize: typography.sizes['2xl'], color: colors.text.primary },
  pageSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: 2 },
  logBtn: { backgroundColor: colors.accent.dim, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.25), borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 8 },
  logBtnText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.accent.primary },

  insightStrip: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.13), borderRadius: radius.xl, padding: spacing.base, flexDirection: 'row', alignItems: 'center', marginBottom: spacing.base, ...elevation.card },
  insightChip: { flex: 1, alignItems: 'center', gap: 2 },
  insightVal: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.md, color: colors.accent.primary },
  insightLbl: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },
  insightDiv: { width: 1, height: 28, backgroundColor: colors.border.subtle },

  restCard: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius['2xl'], padding: spacing['2xl'], alignItems: 'center', gap: spacing.base, marginBottom: spacing.sm, ...elevation.card },
  restCardBtn: { alignSelf: 'stretch' },
  restTitle: { fontFamily: typography.fonts.display, fontSize: typography.sizes['2xl'], color: colors.text.primary },
  restSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.base, color: colors.text.secondary, textAlign: 'center', lineHeight: 22 },

  aiCard: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.13), borderRadius: radius['2xl'], padding: spacing.base, marginBottom: spacing.sm, ...elevation.raised },
  aiCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  aiBadge: { backgroundColor: colors.accent.dim, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  aiBadgeText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },
  proTag: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },

  workoutName: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.xl, color: colors.text.primary, marginBottom: spacing.sm },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.bg.elevated, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
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
  exMuscle:    { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
  demoBtn:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent.dim, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 5, alignSelf: 'flex-start', marginTop: 4 },
  demoBtnText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },
  exMeta: { alignItems: 'flex-end' },
  exSets: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.primary },
  exRest: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },

  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  weightInput: {
    backgroundColor: colors.bg.tertiary,
    borderWidth: 1,
    borderColor: withAlpha(colors.accent.primary, 0.3),
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
  aiWeightBtn: { backgroundColor: colors.accent.dim, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.25) },
  aiWeightBtnText: { fontFamily: typography.fonts.bodyMed, fontSize: 10, color: colors.accent.primary },
  prBadge: { backgroundColor: colors.bg.elevated, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  prBadgeText: { fontFamily: typography.fonts.body, fontSize: 10, color: colors.text.tertiary },
  bodywt: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, fontStyle: 'italic' },

  logDiffRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.base, marginBottom: spacing.sm },
  logDiffText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.base, color: colors.text.secondary },

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

  aiSuggestCard:   { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.19), borderRadius: radius.xl, padding: spacing.base, marginBottom: spacing.base, ...elevation.card },
  aiSuggestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  aiSuggestText:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.primary, lineHeight: 20 },
});

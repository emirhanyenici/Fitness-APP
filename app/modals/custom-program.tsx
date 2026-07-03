import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useCustomProgramStore } from '../../stores/customProgramStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { WorkoutExercise } from '../../services/exercisedb';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { useT } from '../../constants/i18n';
import { Icon, workoutIcon, ChevronRight, X, Check, Plus } from '../../components/ui/Icon';

// ─── Exercise Library ─────────────────────────────────────────

interface ExerciseGroup {
  id: string;
  labelKey: string;
  icon: string;
  exercises: WorkoutExercise[];
}

const LIBRARY: ExerciseGroup[] = [
  {
    id: 'chest', labelKey: 'customProgram.grpChest', icon: '🏋️',
    exercises: [
      { name: 'Bench Press',            sets: 4, reps: '8',  rest: '90s', muscle: 'Chest',       equipment: 'barbell'    },
      { name: 'Incline Dumbbell Press', sets: 3, reps: '10', rest: '75s', muscle: 'Upper Chest', equipment: 'dumbbell'   },
      { name: 'Cable Flyes',            sets: 3, reps: '12', rest: '60s', muscle: 'Chest',       equipment: 'cable'      },
      { name: 'Dips',                   sets: 3, reps: '10', rest: '75s', muscle: 'Lower Chest', equipment: 'bodyweight' },
      { name: 'Push Ups',               sets: 3, reps: '15', rest: '60s', muscle: 'Chest',       equipment: 'bodyweight' },
      { name: 'Pec Deck',               sets: 3, reps: '12', rest: '60s', muscle: 'Chest',       equipment: 'machine'    },
      { name: 'Decline Bench Press',    sets: 3, reps: '10', rest: '90s', muscle: 'Lower Chest', equipment: 'barbell'    },
      { name: 'Chest Press Machine',    sets: 3, reps: '12', rest: '60s', muscle: 'Chest',       equipment: 'machine'    },
    ],
  },
  {
    id: 'back', labelKey: 'customProgram.grpBack', icon: '🧗',
    exercises: [
      { name: 'Deadlift',         sets: 4, reps: '5',  rest: '120s', muscle: 'Back',       equipment: 'barbell'    },
      { name: 'Pull Ups',         sets: 4, reps: '8',  rest: '90s',  muscle: 'Lats',       equipment: 'bodyweight' },
      { name: 'Barbell Row',      sets: 4, reps: '8',  rest: '90s',  muscle: 'Back',       equipment: 'barbell'    },
      { name: 'Lat Pulldown',     sets: 3, reps: '12', rest: '60s',  muscle: 'Lats',       equipment: 'cable'      },
      { name: 'Seated Cable Row', sets: 3, reps: '12', rest: '60s',  muscle: 'Mid Back',   equipment: 'cable'      },
      { name: 'Face Pulls',       sets: 3, reps: '15', rest: '45s',  muscle: 'Rear Delts', equipment: 'cable'      },
      { name: 'Dumbbell Row',     sets: 3, reps: '10', rest: '75s',  muscle: 'Back',       equipment: 'dumbbell'   },
      { name: 'Hyperextensions',  sets: 3, reps: '12', rest: '60s',  muscle: 'Lower Back', equipment: 'machine'    },
    ],
  },
  {
    id: 'legs', labelKey: 'customProgram.grpLegs', icon: '🦵',
    exercises: [
      { name: 'Squats',                sets: 4, reps: '8',  rest: '120s', muscle: 'Quads',      equipment: 'barbell'    },
      { name: 'Romanian Deadlift',     sets: 3, reps: '10', rest: '90s',  muscle: 'Hamstrings', equipment: 'barbell'    },
      { name: 'Leg Press',             sets: 3, reps: '12', rest: '90s',  muscle: 'Quads',      equipment: 'machine'    },
      { name: 'Walking Lunges',        sets: 3, reps: '12', rest: '60s',  muscle: 'Glutes',     equipment: 'bodyweight' },
      { name: 'Leg Curl',              sets: 3, reps: '12', rest: '60s',  muscle: 'Hamstrings', equipment: 'machine'    },
      { name: 'Calf Raises',           sets: 4, reps: '15', rest: '45s',  muscle: 'Calves',     equipment: 'bodyweight' },
      { name: 'Hip Thrusts',           sets: 3, reps: '10', rest: '75s',  muscle: 'Glutes',     equipment: 'barbell'    },
      { name: 'Leg Extension',         sets: 3, reps: '12', rest: '60s',  muscle: 'Quads',      equipment: 'machine'    },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '10', rest: '75s',  muscle: 'Quads',      equipment: 'bodyweight' },
    ],
  },
  {
    id: 'shoulders', labelKey: 'customProgram.grpShoulders', icon: '🏊',
    exercises: [
      { name: 'Overhead Press',  sets: 4, reps: '8',  rest: '90s', muscle: 'Shoulders',   equipment: 'barbell'  },
      { name: 'Arnold Press',    sets: 3, reps: '10', rest: '75s', muscle: 'Shoulders',   equipment: 'dumbbell' },
      { name: 'Lateral Raises',  sets: 4, reps: '15', rest: '60s', muscle: 'Deltoids',    equipment: 'dumbbell' },
      { name: 'Front Raises',    sets: 3, reps: '12', rest: '60s', muscle: 'Front Delts', equipment: 'dumbbell' },
      { name: 'Rear Delt Flyes', sets: 3, reps: '15', rest: '60s', muscle: 'Rear Delts',  equipment: 'dumbbell' },
      { name: 'Shrugs',          sets: 3, reps: '15', rest: '60s', muscle: 'Traps',       equipment: 'dumbbell' },
      { name: 'Upright Row',     sets: 3, reps: '12', rest: '60s', muscle: 'Traps',       equipment: 'barbell'  },
    ],
  },
  {
    id: 'arms', labelKey: 'customProgram.grpArms', icon: '💪',
    exercises: [
      { name: 'Barbell Curl',           sets: 4, reps: '10', rest: '60s', muscle: 'Biceps',  equipment: 'barbell'  },
      { name: 'Hammer Curl',            sets: 3, reps: '12', rest: '60s', muscle: 'Biceps',  equipment: 'dumbbell' },
      { name: 'Preacher Curl',          sets: 3, reps: '10', rest: '60s', muscle: 'Biceps',  equipment: 'barbell'  },
      { name: 'Concentration Curl',     sets: 3, reps: '12', rest: '45s', muscle: 'Biceps',  equipment: 'dumbbell' },
      { name: 'Close-Grip Bench Press', sets: 4, reps: '8',  rest: '75s', muscle: 'Triceps', equipment: 'barbell'  },
      { name: 'Skull Crushers',         sets: 3, reps: '10', rest: '60s', muscle: 'Triceps', equipment: 'barbell'  },
      { name: 'Tricep Pushdown',        sets: 3, reps: '12', rest: '45s', muscle: 'Triceps', equipment: 'cable'    },
      { name: 'Overhead Tricep Ext',    sets: 3, reps: '12', rest: '60s', muscle: 'Triceps', equipment: 'dumbbell' },
    ],
  },
  {
    id: 'core', labelKey: 'customProgram.grpCore', icon: '🔥',
    exercises: [
      { name: 'Plank',             sets: 3, reps: '60s', rest: '30s', muscle: 'Core',     equipment: 'bodyweight' },
      { name: 'Russian Twists',    sets: 3, reps: '20',  rest: '30s', muscle: 'Obliques', equipment: 'bodyweight' },
      { name: 'Bicycle Crunches',  sets: 3, reps: '20',  rest: '30s', muscle: 'Abs',      equipment: 'bodyweight' },
      { name: 'Leg Raises',        sets: 3, reps: '15',  rest: '30s', muscle: 'Abs',      equipment: 'bodyweight' },
      { name: 'Mountain Climbers', sets: 3, reps: '45s', rest: '30s', muscle: 'Core',     equipment: 'bodyweight' },
      { name: 'Ab Rollout',        sets: 3, reps: '10',  rest: '45s', muscle: 'Core',     equipment: 'bodyweight' },
      { name: 'Dead Bug',          sets: 3, reps: '10',  rest: '30s', muscle: 'Core',     equipment: 'bodyweight' },
    ],
  },
  {
    id: 'cardio', labelKey: 'customProgram.grpCardio', icon: '🏃',
    exercises: [
      { name: 'Jump Rope',         sets: 3, reps: '60s', rest: '30s', muscle: 'Full Body', equipment: 'bodyweight' },
      { name: 'Burpees',           sets: 3, reps: '15',  rest: '45s', muscle: 'Full Body', equipment: 'bodyweight' },
      { name: 'High Knees',        sets: 3, reps: '45s', rest: '20s', muscle: 'Legs',      equipment: 'bodyweight' },
      { name: 'Box Jumps',         sets: 4, reps: '10',  rest: '60s', muscle: 'Legs',      equipment: 'bodyweight' },
      { name: 'Jumping Jacks',     sets: 3, reps: '45s', rest: '30s', muscle: 'Full Body', equipment: 'bodyweight' },
      { name: 'Sprint Intervals',  sets: 5, reps: '30s', rest: '90s', muscle: 'Full Body', equipment: 'bodyweight' },
    ],
  },
];

// ─── Week day config (Mon first) ─────────────────────────────

const WEEK = [
  { index: 1, labelKey: 'customProgram.mon', short: 'Mon' },
  { index: 2, labelKey: 'customProgram.tue', short: 'Tue' },
  { index: 3, labelKey: 'customProgram.wed', short: 'Wed' },
  { index: 4, labelKey: 'customProgram.thu', short: 'Thu' },
  { index: 5, labelKey: 'customProgram.fri', short: 'Fri' },
  { index: 6, labelKey: 'customProgram.sat', short: 'Sat' },
  { index: 0, labelKey: 'customProgram.sun', short: 'Sun' },
];

// ─── Main Modal ───────────────────────────────────────────────

export default function CustomProgramModal() {
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const days = useCustomProgramStore((s) => s.days);
  const setSelectedProgram = useWorkoutStore((s) => s.setSelectedProgram);
  const setSelectedType    = useWorkoutStore((s) => s.setSelectedType);
  const t = useT();

  const handleUse = () => {
    setSelectedProgram('custom' as any);
    setSelectedType('custom');
    router.dismissAll();
  };

  if (editingDay !== null) {
    const dayInfo = WEEK.find((d) => d.index === editingDay)!;
    return (
      <DayEditor
        dayIndex={editingDay}
        dayLabel={t(dayInfo.labelKey)}
        onBack={() => setEditingDay(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.handle} />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('customProgram.title')}</Text>
          <Text style={styles.sub}>{t('customProgram.subtitle')}</Text>
        </View>
        <TouchableOpacity style={styles.useBtn} onPress={handleUse} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('customProgram.useThisA11y')}>
          <Text style={styles.useBtnText}>{t('customProgram.useThis')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ gap: spacing.sm, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {WEEK.map((day) => {
          const plan = days[day.index];
          const count = plan?.exercises.length ?? 0;
          const preview = plan?.exercises.slice(0, 3).map((e) => e.name).join(', ');
          return (
            <TouchableOpacity
              key={day.index}
              style={styles.dayRow}
              onPress={() => setEditingDay(day.index)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={count > 0
                ? t('customProgram.dayWithExercises', { day: t(day.labelKey), count, preview })
                : t('customProgram.dayRest', { day: t(day.labelKey) })}
            >
              <View style={[styles.dayBadge, count > 0 && styles.dayBadgeActive]}>
                <Text style={[styles.dayShort, count > 0 && styles.dayShortActive]}>{day.short}</Text>
              </View>
              <View style={styles.dayInfo}>
                <Text style={styles.dayLabel}>{t(day.labelKey)}</Text>
                {count > 0
                  ? <Text style={styles.daySub} numberOfLines={1}>{preview}{count > 3 ? ` +${count - 3}` : ''}</Text>
                  : <Text style={[styles.daySub, { color: colors.text.tertiary }]}>{t('customProgram.restDayTapAdd')}</Text>}
              </View>
              <View style={styles.dayRight}>
                {count > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{count}</Text>
                  </View>
                )}
                <Icon icon={ChevronRight} size="md" color={colors.text.tertiary} />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('customProgram.close')}>
        <Text style={styles.cancelText}>{t('customProgram.close')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Day Editor ───────────────────────────────────────────────

function DayEditor({ dayIndex, dayLabel, onBack }: {
  dayIndex: number;
  dayLabel: string;
  onBack: () => void;
}) {
  const [activeGroup, setActiveGroup] = useState('chest');
  const days    = useCustomProgramStore((s) => s.days);
  const setDay  = useCustomProgramStore((s) => s.setDay);
  const clearDay = useCustomProgramStore((s) => s.clearDay);
  const t = useT();

  const current = days[dayIndex]?.exercises ?? [];
  const isAdded = (name: string) => current.some((e) => e.name === name);

  const add = (ex: WorkoutExercise) => {
    if (isAdded(ex.name)) return;
    setDay(dayIndex, { exercises: [...current, ex] });
  };

  const remove = (name: string) => {
    const next = current.filter((e) => e.name !== name);
    if (next.length === 0) clearDay(dayIndex);
    else setDay(dayIndex, { exercises: next });
  };

  const group = LIBRARY.find((g) => g.id === activeGroup)!;

  return (
    <View style={styles.container}>
      <View style={styles.handle} />

      {/* Header */}
      <View style={styles.dayEditHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('customProgram.goBack')}>
          <Text style={styles.backLink}>{t('customProgram.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.dayEditTitle}>{dayLabel}</Text>
        {current.length > 0 && (
          <TouchableOpacity
            onPress={() => Alert.alert(t('customProgram.clearDay'), t('customProgram.clearDayConfirm', { day: dayLabel }), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('customProgram.clear'), style: 'destructive', onPress: () => clearDay(dayIndex) },
            ])}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('customProgram.clearAllA11y', { day: dayLabel })}
          >
            <Text style={styles.clearText}>{t('customProgram.clear')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* My Exercises */}
        <Text style={styles.sectionLabel}>
          {current.length > 0 ? t('customProgram.myExercises', { count: current.length }) : t('customProgram.noExercisesYet')}
        </Text>

        {current.length > 0 && (
          <View style={styles.currentList}>
            {current.map((ex, i) => (
              <View key={ex.name + i} style={styles.currentRow}>
                <View style={styles.currentInfo}>
                  <Text style={styles.currentName}>{ex.name}</Text>
                  <Text style={styles.currentMeta}>{t('customProgram.setsReps', { sets: ex.sets, reps: ex.reps, muscle: ex.muscle })}</Text>
                </View>
                <TouchableOpacity onPress={() => remove(ex.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('customProgram.removeA11y', { name: ex.name })}>
                  <Icon icon={X} size="sm" color={colors.text.tertiary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Group tabs */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.base }]}>{t('customProgram.addExercises')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupTabsScroll} contentContainerStyle={styles.groupTabs}>
          {LIBRARY.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={[styles.groupTab, activeGroup === g.id && styles.groupTabActive]}
              onPress={() => setActiveGroup(g.id)}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeGroup === g.id }}
              accessibilityLabel={t('customProgram.groupA11y', { group: t(g.labelKey) })}
            >
              <Icon icon={workoutIcon(g.icon)} size="sm" color={colors.accent.primary} />
              <Text style={[styles.groupTabLabel, activeGroup === g.id && styles.groupTabLabelActive]}>
                {t(g.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Exercise list */}
        <View style={styles.libraryList}>
          {group.exercises.map((ex, i) => {
            const added = isAdded(ex.name);
            return (
              <View
                key={ex.name + i}
                style={[styles.libRow, i === group.exercises.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={styles.libInfo}>
                  <Text style={styles.libName}>{ex.name}</Text>
                  <Text style={styles.libMeta}>
                    {ex.sets} × {ex.reps} · {ex.muscle} · {ex.equipment}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.addBtn, added && styles.addBtnDone]}
                  onPress={() => add(ex)}
                  disabled={added}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: added }}
                  accessibilityLabel={added ? t('customProgram.alreadyAdded', { name: ex.name }) : t('customProgram.addExerciseA11y', { name: ex.name, sets: ex.sets, reps: ex.reps })}
                >
                  <Icon
                    icon={added ? Check : Plus}
                    size="sm"
                    color={added ? colors.status.success : colors.accent.primary}
                    strokeWidth={2.5}
                  />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.tertiary, padding: spacing.base, paddingTop: spacing.lg },
  handle:    { width: 40, height: 4, backgroundColor: colors.border.default, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.xl },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  title:       { fontFamily: typography.fonts.display, fontSize: typography.sizes.xl, color: colors.text.primary },
  sub:         { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: 2 },
  useBtn:      { backgroundColor: colors.accent.primary, borderRadius: radius.full, paddingHorizontal: 18, paddingVertical: 9 },
  useBtnText:  { fontFamily: typography.fonts.display, fontSize: typography.sizes.sm, color: colors.text.inverse },

  dayRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.base, gap: spacing.sm },
  dayBadge:      { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg.tertiary, borderWidth: 1, borderColor: colors.border.subtle, alignItems: 'center', justifyContent: 'center' },
  dayBadgeActive:{ backgroundColor: colors.accent.dim, borderColor: colors.accent.primary + '60' },
  dayShort:      { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.text.tertiary },
  dayShortActive:{ color: colors.accent.primary },
  dayInfo:       { flex: 1 },
  dayLabel:      { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  daySub:        { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.secondary, marginTop: 2 },
  dayRight:      { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  countBadge:    { backgroundColor: colors.accent.dim, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  countText:     { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },

  cancelBtn:   { paddingVertical: spacing.base, alignItems: 'center' },
  cancelText:  { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.secondary },

  // Day Editor
  dayEditHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  dayEditTitle:  { fontFamily: typography.fonts.display, fontSize: typography.sizes.lg, color: colors.text.primary },
  backLink:      { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.accent.primary },
  clearText:     { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.status.danger },

  sectionLabel: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.sm, color: colors.text.secondary, marginBottom: spacing.sm },

  currentList: { backgroundColor: colors.bg.elevated, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border.subtle, overflow: 'hidden', marginBottom: spacing.sm },
  currentRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.base, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  currentInfo: { flex: 1 },
  currentName: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.primary },
  currentMeta: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },

  groupTabsScroll: { marginBottom: spacing.sm },
  groupTabs:       { flexDirection: 'row', gap: spacing.xs, paddingBottom: 2 },
  groupTab:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  groupTabActive:  { backgroundColor: colors.accent.dim, borderColor: colors.accent.primary + '60' },
  groupTabLabel:   { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.text.secondary },
  groupTabLabelActive: { color: colors.accent.primary },

  libraryList: { backgroundColor: colors.bg.elevated, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border.subtle, overflow: 'hidden' },
  libRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.base, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  libInfo:     { flex: 1 },
  libName:     { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.primary },
  libMeta:     { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
  addBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnDone:  { backgroundColor: colors.status.success },
});

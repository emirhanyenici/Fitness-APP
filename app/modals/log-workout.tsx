import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useUserStore } from '../../stores/userStore';
import { computeTargets } from '../../services/recommendations';
import { getAvailablePrograms, recommendProgram, PROGRAMS, ProgramType } from '../../services/workoutPrograms';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';

export default function LogWorkoutModal() {
  const setSelectedProgram = useWorkoutStore((s) => s.setSelectedProgram);
  const setSelectedType = useWorkoutStore((s) => s.setSelectedType);
  const currentProgram = useWorkoutStore((s) => s.selectedProgram);
  const profile = useUserStore((s) => s.profile);
  const targets = computeTargets(profile);
  const goal = profile?.primary_goal ?? 'general_health';
  const daysPerWeek = targets.workoutDaysPerWeek;

  const recommended = recommendProgram(goal, daysPerWeek);
  const available = getAvailablePrograms(daysPerWeek);

  // Put recommended first, then rest, then rest day at bottom
  const sorted = [
    ...available.filter(p => p.id === recommended),
    ...available.filter(p => p.id !== recommended),
  ];

  const handleSelect = (programId: ProgramType) => {
    setSelectedProgram(programId);
    setSelectedType(programId); // keep backward compat
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <Text style={styles.title}>Choose Program</Text>
      <Text style={styles.sub}>
        Based on your goal ({daysPerWeek}× per week)
      </Text>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {sorted.map((p) => {
          const isRecommended = p.id === recommended;
          const isCurrent = p.id === currentProgram;
          return (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.row,
                isRecommended && styles.rowRecommended,
                isCurrent && styles.rowCurrent,
              ]}
              activeOpacity={0.75}
              onPress={() => handleSelect(p.id)}
            >
              <View style={[styles.rowIcon, isRecommended && styles.rowIconRecommended]}>
                <Text style={{ fontSize: 26 }}>{p.icon}</Text>
              </View>
              <View style={styles.rowInfo}>
                <View style={styles.rowLabelRow}>
                  <Text style={styles.rowLabel}>{p.name}</Text>
                  {isRecommended && (
                    <View style={styles.recBadge}>
                      <Text style={styles.recBadgeText}>Recommended</Text>
                    </View>
                  )}
                  {isCurrent && !isRecommended && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>Current</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.rowSub}>{p.sub}</Text>
                <Text style={styles.rowDays}>{p.minDays}–{p.maxDays} days/week</Text>
              </View>
              <Text style={styles.rowArrow}>›</Text>
            </TouchableOpacity>
          );
        })}

        {/* Rest day option */}
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.75}
          onPress={() => { setSelectedType('rest'); setSelectedProgram(null); router.back(); }}
        >
          <View style={styles.rowIcon}>
            <Text style={{ fontSize: 26 }}>😴</Text>
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Rest Day</Text>
            <Text style={styles.rowSub}>Active recovery & stretching</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
      </ScrollView>
      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.tertiary, padding: spacing.base, paddingTop: spacing.lg },
  handle: { width: 40, height: 4, backgroundColor: colors.border.default, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.xl },
  title: { fontFamily: typography.fonts.display, fontSize: typography.sizes.xl, color: colors.text.primary, marginBottom: spacing.xs },
  sub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginBottom: spacing.xl },

  list: { gap: spacing.sm, paddingBottom: spacing.base },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.base, gap: spacing.sm },
  rowRecommended: { borderColor: colors.accent.primary + '60', backgroundColor: colors.accent.dim },
  rowCurrent: { borderColor: colors.status.success + '60' },
  rowIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bg.tertiary, alignItems: 'center', justifyContent: 'center' },
  rowIconRecommended: { backgroundColor: colors.accent.primary + '15' },
  rowInfo: { flex: 1 },
  rowLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  rowLabel: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  rowSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
  rowDays: { fontFamily: typography.fonts.mono, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 3 },
  rowArrow: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xl, color: colors.text.tertiary },

  recBadge: { backgroundColor: colors.accent.primary + '20', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  recBadgeText: { fontFamily: typography.fonts.bodyMed, fontSize: 10, color: colors.accent.primary },
  currentBadge: { backgroundColor: colors.status.success + '20', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  currentBadgeText: { fontFamily: typography.fonts.bodyMed, fontSize: 10, color: colors.status.success },

  cancelBtn: { paddingVertical: spacing.base, alignItems: 'center' },
  cancelText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.secondary },
});

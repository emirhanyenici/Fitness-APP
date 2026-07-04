import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useUserStore } from '../../stores/userStore';
import { computeTargets } from '../../services/recommendations';
import { getAvailablePrograms, recommendProgram, PROGRAMS, ProgramType } from '../../services/workoutPrograms';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { colors, withAlpha } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { useT } from '../../constants/i18n';
import { Icon, workoutIcon, NotebookPen, Bed, ChevronRight } from '../../components/ui/Icon';

export default function LogWorkoutModal() {
  const t = useT();
  const setSelectedProgram = useWorkoutStore((s) => s.setSelectedProgram);
  const setSelectedType = useWorkoutStore((s) => s.setSelectedType);
  const currentProgram = useWorkoutStore((s) => s.selectedProgram);
  const profile = useUserStore((s) => s.profile);
  const isPro   = useSubscriptionStore((s) => s.isPro);
  const targets = computeTargets(profile);
  const goal = profile?.primary_goal ?? 'general_health';
  const daysPerWeek = targets.workoutDaysPerWeek;

  const recommended = recommendProgram(goal, daysPerWeek);
  const available = getAvailablePrograms(daysPerWeek).filter(p => p.id !== 'custom');

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
      <Text style={styles.title}>{t('logWorkout.chooseProgram')}</Text>
      <Text style={styles.sub}>
        {t('logWorkout.basedOnGoal', { days: daysPerWeek })}
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
              accessibilityRole="button"
              accessibilityState={{ selected: isCurrent }}
              accessibilityLabel={t('logWorkout.programA11y', { name: p.name, rec: isRecommended ? t('logWorkout.recSuffix') : '', cur: isCurrent ? t('logWorkout.curSuffix') : '', sub: p.sub, min: p.minDays, max: p.maxDays })}
            >
              <View style={[styles.rowIcon, isRecommended && styles.rowIconRecommended]}>
                <Icon icon={workoutIcon(p.icon)} size="lg" color={colors.accent.primary} />
              </View>
              <View style={styles.rowInfo}>
                <View style={styles.rowLabelRow}>
                  <Text style={styles.rowLabel}>{p.name}</Text>
                  {isRecommended && (
                    <View style={styles.recBadge}>
                      <Text style={styles.recBadgeText}>{t('logWorkout.recommended')}</Text>
                    </View>
                  )}
                  {isCurrent && !isRecommended && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>{t('logWorkout.current')}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.rowSub}>{p.sub}</Text>
                <Text style={styles.rowDays}>{t('logWorkout.daysPerWeek', { min: p.minDays, max: p.maxDays })}</Text>
              </View>
              <Icon icon={ChevronRight} size="md" color={colors.text.tertiary} />
            </TouchableOpacity>
          );
        })}

        {/* Custom Program — PRO only */}
        <TouchableOpacity
          style={[styles.row, !isPro && styles.rowLocked, currentProgram === 'custom' && styles.rowCurrent]}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityState={{ selected: currentProgram === ('custom' as any) }}
          accessibilityLabel={t('logWorkout.customA11y', { pro: !isPro ? '. ' + t('common.proFeature') : '' })}
          onPress={() => {
            if (!isPro) { router.push('/paywall'); return; }
            setSelectedProgram('custom' as any);
            setSelectedType('custom');
            router.back();
          }}
        >
          <View style={styles.rowIcon}>
            <Icon icon={NotebookPen} size="lg" color={colors.accent.primary} />
          </View>
          <View style={styles.rowInfo}>
            <View style={styles.rowLabelRow}>
              <Text style={styles.rowLabel}>{t('logWorkout.customProgram')}</Text>
              {!isPro && (
                <View style={styles.proBadge}><Text style={styles.proBadgeText}>{t('common.pro')}</Text></View>
              )}
              {isPro && currentProgram === ('custom' as any) && (
                <View style={styles.currentBadge}><Text style={styles.currentBadgeText}>{t('logWorkout.active')}</Text></View>
              )}
            </View>
            <Text style={styles.rowSub}>{t('logWorkout.customProgramSub')}</Text>
          </View>
          {isPro ? (
            <TouchableOpacity
              onPress={() => router.push('/modals/custom-program')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t('logWorkout.editCustom')}
            >
              <Text style={styles.editCustomText}>{t('logWorkout.edit')}</Text>
            </TouchableOpacity>
          ) : (
            <Icon icon={ChevronRight} size="md" color={colors.text.tertiary} />
          )}
        </TouchableOpacity>

        {/* Rest day option */}
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={t('logWorkout.restDayA11y')}
          onPress={() => { setSelectedType('rest'); setSelectedProgram(null); router.back(); }}
        >
          <View style={styles.rowIcon}>
            <Icon icon={Bed} size="lg" color={colors.violet.primary} />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>{t('logWorkout.restDay')}</Text>
            <Text style={styles.rowSub}>{t('logWorkout.restDaySub')}</Text>
          </View>
          <Icon icon={ChevronRight} size="md" color={colors.text.tertiary} />
        </TouchableOpacity>
      </ScrollView>
      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('logWorkout.cancelClose')}>
        <Text style={styles.cancelText}>{t('common.cancel')}</Text>
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
  rowRecommended: { borderColor: withAlpha(colors.accent.primary, 0.38), backgroundColor: colors.accent.dim },
  rowCurrent: { borderColor: withAlpha(colors.status.success, 0.38) },
  rowIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bg.tertiary, alignItems: 'center', justifyContent: 'center' },
  rowIconRecommended: { backgroundColor: withAlpha(colors.accent.primary, 0.08) },
  rowInfo: { flex: 1 },
  rowLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  rowLabel: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  rowSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
  rowDays: { fontFamily: typography.fonts.mono, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 3 },

  recBadge: { backgroundColor: withAlpha(colors.accent.primary, 0.13), borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  recBadgeText: { fontFamily: typography.fonts.bodyMed, fontSize: 10, color: colors.accent.primary },
  currentBadge: { backgroundColor: withAlpha(colors.status.success, 0.13), borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  currentBadgeText: { fontFamily: typography.fonts.bodyMed, fontSize: 10, color: colors.status.success },

  editCustomText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.accent.primary },
  rowLocked:    { opacity: 0.7 },
  proBadge:     { backgroundColor: colors.accent.dim, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  proBadgeText: { fontFamily: typography.fonts.bodyMed, fontSize: 10, color: colors.accent.primary },

  cancelBtn: { paddingVertical: spacing.base, alignItems: 'center' },
  cancelText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.secondary },
});

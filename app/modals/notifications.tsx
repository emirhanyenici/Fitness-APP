import { View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useUserStore } from '../../stores/userStore';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { useT } from '../../constants/i18n';

type NotifKey = 'notif_workout' | 'notif_calorie' | 'notif_streak' | 'notif_sleep';

const NOTIF_ROWS: {
  key: NotifKey;
  icon: string;
  labelKey: string;
  subKey: string;
  time: string;
}[] = [
  { key: 'notif_workout', icon: '🏋️', labelKey: 'notifications.workoutLabel', subKey: 'notifications.workoutSub', time: '09:00 AM' },
  { key: 'notif_calorie', icon: '🍽️', labelKey: 'notifications.calorieLabel', subKey: 'notifications.calorieSub', time: '07:00 PM' },
  { key: 'notif_streak',  icon: '🔥', labelKey: 'notifications.streakLabel',  subKey: 'notifications.streakSub',  time: '08:00 PM' },
  { key: 'notif_sleep',   icon: '🌙', labelKey: 'notifications.sleepLabel',   subKey: 'notifications.sleepSub',   time: '10:00 PM' },
];

export default function NotificationsModal() {
  const profile       = useUserStore((s) => s.profile);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const t             = useT();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('notifications.goBack')}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('notifications.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <Text style={styles.sectionSub}>
        {t('notifications.sectionSub')}
      </Text>

      <View style={styles.card}>
        {NOTIF_ROWS.map((row, i) => {
          const enabled = profile?.[row.key] ?? false;
          return (
            <View
              key={row.key}
              style={[styles.row, i === NOTIF_ROWS.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={styles.iconWrap}>
                <Text style={{ fontSize: 20 }}>{row.icon}</Text>
              </View>
              <View style={styles.rowMid}>
                <Text style={styles.rowLabel}>{t(row.labelKey)}</Text>
                <Text style={styles.rowSub}>{t(row.subKey)}</Text>
                {enabled && (
                  <View style={styles.timeBadge}>
                    <Text style={styles.timeText}>⏰  {row.time}</Text>
                  </View>
                )}
              </View>
              <Switch
                value={enabled}
                onValueChange={(val) => updateProfile({ [row.key]: val })}
                trackColor={{ false: colors.border.subtle, true: colors.accent.primary + '80' }}
                thumbColor={enabled ? colors.accent.primary : colors.text.tertiary}
                accessibilityRole="switch"
                accessibilityLabel={t('notifications.rowA11y', { label: t(row.labelKey), sub: t(row.subKey) })}
                accessibilityState={{ checked: enabled }}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          {t('notifications.infoText')}
        </Text>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.base },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, marginBottom: spacing.xl },
  back:   { fontSize: 24, color: colors.text.primary, width: 32 },
  title:  { fontFamily: typography.fonts.display, fontSize: typography.sizes.xl, color: colors.text.primary },

  sectionSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, lineHeight: 20, marginBottom: spacing.base },

  card: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.base },

  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: spacing.base, borderBottomWidth: 1, borderBottomColor: colors.border.subtle, gap: spacing.sm },
  iconWrap: { width: 40, height: 40, borderRadius: radius.lg, backgroundColor: colors.bg.tertiary, alignItems: 'center', justifyContent: 'center' },
  rowMid:   { flex: 1 },
  rowLabel: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.primary, marginBottom: 3 },
  rowSub:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, lineHeight: 16 },
  timeBadge: { marginTop: 5, alignSelf: 'flex-start', backgroundColor: colors.accent.dim, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  timeText:  { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.accent.primary },

  infoBox:  { backgroundColor: colors.bg.elevated, borderRadius: radius.lg, padding: spacing.base },
  infoText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, lineHeight: 18 },
});

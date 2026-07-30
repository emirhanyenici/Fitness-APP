import { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity, Alert, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../stores/userStore';
import {
  NotifKey, NOTIF_KEYS, resolveTime, requestNotificationPermission, syncNotification,
} from '../../services/notifications';
import { withAlpha, type Colors } from '../../constants/colors';
import { useColors } from '../../constants/useColors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { useT } from '../../constants/i18n';
import {
  Icon, IconComponent, Dumbbell, UtensilsCrossed, Flame, Moon, ArrowLeft, Timer,
} from '../../components/ui/Icon';

const NOTIF_META: Record<NotifKey, { icon: IconComponent; labelKey: string; subKey: string }> = {
  notif_workout: { icon: Dumbbell,        labelKey: 'notifications.workoutLabel', subKey: 'notifications.workoutSub' },
  notif_calorie: { icon: UtensilsCrossed, labelKey: 'notifications.calorieLabel', subKey: 'notifications.calorieSub' },
  notif_streak:  { icon: Flame,           labelKey: 'notifications.streakLabel',  subKey: 'notifications.streakSub' },
  notif_sleep:   { icon: Moon,            labelKey: 'notifications.sleepLabel',   subKey: 'notifications.sleepSub' },
};

/** "HH:mm" -> a Date carrying that time (today's date is irrelevant, only hour/minute are read). */
function timeToDate(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function formatTime(time: string): string {
  const d = timeToDate(time);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function NotificationsModal() {
  const insets        = useSafeAreaInsets();
  const profile       = useUserStore((s) => s.profile);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const t             = useT();
  const colors        = useColors();
  const styles        = useMemo(() => getStyles(colors), [colors]);
  const [iosPickerKey, setIosPickerKey] = useState<NotifKey | null>(null);

  const handleToggle = async (key: NotifKey, val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(t('notifications.permissionDeniedTitle'), t('notifications.permissionDeniedBody'));
        return;
      }
    }
    updateProfile({ [key]: val });
    void syncNotification(key, val, resolveTime(profile, key));
  };

  const commitTime = (key: NotifKey, date: Date) => {
    const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    updateProfile({ [`${key}_time`]: time });
    if (profile?.[key]) void syncNotification(key, true, time);
  };

  const openTimePicker = (key: NotifKey) => {
    const value = timeToDate(resolveTime(profile, key));
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'time',
        onChange: (_event, date) => { if (date) commitTime(key, date); },
      });
    } else {
      setIosPickerKey(key);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('notifications.goBack')}>
          <Icon icon={ArrowLeft} size="lg" color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('notifications.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <Text style={styles.sectionSub}>
        {t('notifications.sectionSub')}
      </Text>

      <View style={styles.card}>
        {NOTIF_KEYS.map((key, i) => {
          const meta = NOTIF_META[key];
          const enabled = profile?.[key] ?? false;
          const time = resolveTime(profile, key);
          return (
            <View
              key={key}
              style={[styles.row, i === NOTIF_KEYS.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={styles.iconWrap}>
                <Icon icon={meta.icon} size="md" color={colors.accent.primary} />
              </View>
              <View style={styles.rowMid}>
                <Text style={styles.rowLabel}>{t(meta.labelKey)}</Text>
                <Text style={styles.rowSub}>{t(meta.subKey)}</Text>
                {enabled && (
                  <TouchableOpacity
                    style={styles.timeBadge}
                    onPress={() => openTimePicker(key)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('notifications.changeTimeA11y', { label: t(meta.labelKey) })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Icon icon={Timer} size={12} color={colors.accent.primary} />
                      <Text style={styles.timeText}>{formatTime(time)}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {Platform.OS === 'ios' && iosPickerKey === key && (
                  <View style={styles.iosPickerWrap}>
                    <DateTimePicker
                      value={timeToDate(time)}
                      mode="time"
                      display="spinner"
                      onChange={(_event, date) => { if (date) commitTime(key, date); }}
                    />
                    <TouchableOpacity style={styles.iosPickerDone} onPress={() => setIosPickerKey(null)} activeOpacity={0.8}>
                      <Text style={styles.iosPickerDoneText}>{t('common.done')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              <Switch
                value={enabled}
                onValueChange={(val) => void handleToggle(key, val)}
                trackColor={{ false: colors.border.subtle, true: withAlpha(colors.accent.primary, 0.5) }}
                thumbColor={enabled ? colors.accent.primary : colors.text.tertiary}
                accessibilityRole="switch"
                accessibilityLabel={t('notifications.rowA11y', { label: t(meta.labelKey), sub: t(meta.subKey) })}
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

const getStyles = (colors: Colors) => StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.base },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
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

  iosPickerWrap: { marginTop: spacing.sm, backgroundColor: colors.bg.tertiary, borderRadius: radius.lg, padding: spacing.xs, alignItems: 'center' },
  iosPickerDone: { alignSelf: 'stretch', backgroundColor: colors.accent.primary, borderRadius: radius.full, paddingVertical: 8, alignItems: 'center', marginTop: spacing.xs },
  iosPickerDoneText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.inverse },

  infoBox:  { backgroundColor: colors.bg.elevated, borderRadius: radius.lg, padding: spacing.base },
  infoText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, lineHeight: 18 },
});

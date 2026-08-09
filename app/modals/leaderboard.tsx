import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import {
  type LeaderboardMetric, type LeaderboardRow,
  fetchTop, fetchMine, fetchMyRank, upsertMyStats, leaveLeaderboard, reportUser,
  sanitizeNickname, isNicknameBlocked, formatHandle,
} from '../../services/leaderboard';
import { withAlpha, type Colors } from '../../constants/colors';
import { useColors } from '../../constants/useColors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { getElevation } from '../../constants/elevation';
import { useT } from '../../constants/i18n';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Icon, ArrowLeft, Trophy, Flame, Target, Flag } from '../../components/ui/Icon';

type Tab = LeaderboardMetric;
const TABS: { key: Tab; labelKey: string; icon: typeof Trophy }[] = [
  { key: 'streak',       labelKey: 'leaderboard.tabStreak',   icon: Flame },
  { key: 'avg_score',    labelKey: 'leaderboard.tabScore',    icon: Trophy },
  { key: 'effort_score', labelKey: 'leaderboard.tabEffort',   icon: Target },
];

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const userId = useAuthStore((s) => s.user?.id);
  const profile = useUserStore((s) => s.profile);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const isOptedIn = !!profile?.leaderboard_optin;

  const [nicknameDraft, setNicknameDraft] = useState('');
  const [joining, setJoining] = useState(false);

  const [tab, setTab] = useState<Tab>('streak');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [myStats, setMyStats] = useState<LeaderboardRow | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOptedIn || !userId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [top, mine] = await Promise.all([fetchTop(tab, 50), fetchMine(userId)]);
      if (cancelled) return;
      setRows(top);
      setMyStats(mine);
      if (mine) {
        const rank = await fetchMyRank(tab, mine[tab]);
        if (!cancelled) setMyRank(rank);
      } else {
        setMyRank(null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isOptedIn, userId, tab]);

  const handleJoin = async () => {
    const nickname = sanitizeNickname(nicknameDraft);
    if (!nickname) {
      Alert.alert(t('common.error'), t('leaderboard.nicknameRequired'));
      return;
    }
    if (isNicknameBlocked(nickname)) {
      Alert.alert(t('common.error'), t('leaderboard.nicknameBlocked'));
      return;
    }
    if (!userId) return;
    setJoining(true);
    try {
      const ok = await upsertMyStats(userId, nickname, 0, 0, 0);
      if (!ok) {
        Alert.alert(t('common.error'), t('leaderboard.joinFailed'));
        return;
      }
      updateProfile({ leaderboard_optin: true, leaderboard_nickname: nickname });
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = () => {
    Alert.alert(t('leaderboard.leaveConfirmTitle'), t('leaderboard.leaveConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('leaderboard.leave'),
        style: 'destructive',
        onPress: async () => {
          if (!userId) return;
          const ok = await leaveLeaderboard(userId);
          if (!ok) {
            Alert.alert(t('common.error'), t('leaderboard.leaveFailed'));
            return;
          }
          updateProfile({ leaderboard_optin: false, leaderboard_nickname: undefined });
        },
      },
    ]);
  };

  const handleReport = (row: LeaderboardRow) => {
    Alert.alert(t('leaderboard.reportConfirmTitle'), t('leaderboard.reportConfirmBody', { name: formatHandle(row.nickname, row.tag) }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('leaderboard.report'),
        onPress: async () => {
          if (!userId) return;
          const ok = await reportUser(userId, row.user_id, row.nickname);
          Alert.alert(t('common.ok'), ok ? t('leaderboard.reportSent') : t('leaderboard.reportFailed'));
        },
      },
    ]);
  };

  const formatValue = (row: LeaderboardRow) => {
    if (tab === 'streak') return `${row.streak}`;
    if (tab === 'avg_score') return `${row.avg_score}`;
    return `${row.effort_score}`;
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Icon icon={ArrowLeft} size="lg" color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('leaderboard.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {!isOptedIn ? (
        <Card style={styles.card}>
          <Icon icon={Trophy} size={36} color={colors.accent.primary} strokeWidth={1.5} />
          <Text style={styles.joinTitle}>{t('leaderboard.joinTitle')}</Text>
          <Text style={styles.joinSub}>{t('leaderboard.joinSub')}</Text>
          <TextInput
            style={styles.nicknameInput}
            value={nicknameDraft}
            onChangeText={setNicknameDraft}
            placeholder={t('leaderboard.nicknamePlaceholder')}
            placeholderTextColor={colors.text.tertiary}
            maxLength={20}
            returnKeyType="done"
            accessibilityLabel={t('leaderboard.nicknamePlaceholder')}
          />
          <Button label={t('leaderboard.join')} onPress={handleJoin} loading={joining} style={{ alignSelf: 'stretch', marginTop: spacing.sm }} />
        </Card>
      ) : (
        <>
          <View style={styles.tabRow}>
            {TABS.map((tb) => (
              <TouchableOpacity
                key={tb.key}
                style={[styles.tabPill, tab === tb.key && styles.tabPillActive]}
                onPress={() => setTab(tb.key)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === tb.key }}
                accessibilityLabel={t(tb.labelKey)}
              >
                <Icon icon={tb.icon} size="sm" color={tab === tb.key ? colors.accent.primary : colors.text.tertiary} />
                <Text style={[styles.tabPillText, tab === tb.key && styles.tabPillTextActive]}>{t(tb.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing.xl }} />
          ) : rows.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon icon={Trophy} size={36} color={colors.text.tertiary} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>{t('leaderboard.empty')}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {rows.map((row, i) => (
                <View
                  key={row.user_id}
                  style={[styles.row, row.user_id === userId && styles.rowMine]}
                >
                  <Text style={styles.rank}>#{i + 1}</Text>
                  <Text style={styles.nickname} numberOfLines={1}>{formatHandle(row.nickname, row.tag)}</Text>
                  <Text style={styles.value}>{formatValue(row)}</Text>
                  {row.user_id !== userId && (
                    <TouchableOpacity
                      onPress={() => handleReport(row)}
                      hitSlop={8}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={t('leaderboard.reportA11y', { name: formatHandle(row.nickname, row.tag) })}
                    >
                      <Icon icon={Flag} size="sm" color={colors.text.tertiary} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {myStats && myRank !== null && myRank > rows.length && (
            <View style={[styles.row, styles.rowMine, { marginTop: spacing.sm }]}>
              <Text style={styles.rank}>#{myRank}</Text>
              <Text style={styles.nickname} numberOfLines={1}>{formatHandle(myStats.nickname, myStats.tag)}</Text>
              <Text style={styles.value}>{formatValue(myStats)}</Text>
            </View>
          )}

          <TouchableOpacity onPress={handleLeave} style={styles.leaveLink} activeOpacity={0.7} accessibilityRole="button">
            <Text style={styles.leaveLinkText}>{t('leaderboard.leave')}</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const getStyles = (colors: Colors) => {
  const elevation = getElevation(colors);
  return StyleSheet.create({
    screen:  { flex: 1, backgroundColor: colors.bg.primary },
    content: { padding: spacing.base, paddingBottom: spacing.xl },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.base },
    title:  { fontFamily: typography.fonts.display, fontSize: typography.sizes.xl, color: colors.text.primary },

    card: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
    joinTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.lg, color: colors.text.primary, textAlign: 'center' },
    joinSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, textAlign: 'center' },
    nicknameInput: {
      fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.primary,
      borderWidth: 1, borderColor: colors.border.default, borderRadius: radius.full,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.base, alignSelf: 'stretch', textAlign: 'center', marginTop: spacing.sm,
    },

    tabRow: { flexDirection: 'row', backgroundColor: colors.bg.elevated, borderRadius: radius.full, padding: 3, marginBottom: spacing.base },
    tabPill: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.sm, borderRadius: radius.full },
    tabPillActive: { backgroundColor: colors.bg.secondary, ...elevation.card },
    tabPillText: { fontFamily: typography.fonts.body, fontSize: 10, color: colors.text.tertiary },
    tabPillTextActive: { color: colors.accent.primary, fontFamily: typography.fonts.bodyMed },

    list: { gap: spacing.sm },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle,
      borderRadius: radius.xl, padding: spacing.base,
    },
    rowMine: { borderColor: withAlpha(colors.accent.primary, 0.4), backgroundColor: withAlpha(colors.accent.primary, 0.08) },
    rank: { width: 36, fontFamily: typography.fonts.mono, fontSize: typography.sizes.sm, color: colors.text.tertiary },
    nickname: { flex: 1, fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.primary },
    value: { fontFamily: typography.fonts.mono, fontSize: typography.sizes.base, color: colors.accent.primary },

    emptyState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
    emptyTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },

    leaveLink: { alignItems: 'center', paddingVertical: spacing.base, marginTop: spacing.sm },
    leaveLinkText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.status.danger },
  });
};

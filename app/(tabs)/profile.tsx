import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { useNutritionStore } from '../../stores/nutritionStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useAISuggestionsStore } from '../../stores/aiSuggestionsStore';
import { useNovraScore } from '../../hooks/useNovraScore';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';

const SETTINGS = [
  { icon: '🔔', label: 'Notifications', sub: '',           action: 'notifications' },
  { icon: '📏', label: 'Units',         sub: 'Metric',     action: 'units' },
  { icon: '❤️', label: 'Apple Health',  sub: 'Connect',    action: 'health' },
  { icon: '💳', label: 'Subscription',  sub: 'Free plan',  action: 'subscription' },
  { icon: '🔒', label: 'Privacy Policy',sub: '',           action: 'privacy' },
  { icon: '📄', label: 'Terms of Service', sub: '',        action: 'terms' },
];

export default function ProfileScreen() {
  const { signOut, user } = useAuthStore();
  const profile      = useUserStore((s) => s.profile);
  const clearProfile = useUserStore((s) => s.clearProfile);
  const { plan, isPro } = useSubscriptionStore();

  // All store clear actions — called together on sign-out
  const clearEntries    = useNutritionStore((s) => s.clearEntries);
  const clearHistory    = useWorkoutStore((s) => s.clearHistory);
  const clearRecovery   = useRecoveryStore((s) => s.clearEntries);
  const clearAI         = useAISuggestionsStore((s) => s.clearAll);

  // Shared score hook — single source of truth, consistent with Home screen
  const { score, scoreColor, deltaLabel, deltaColor } = useNovraScore();

  const handleSetting = (action: string) => {
    switch (action) {
      case 'subscription':
        router.push('/paywall');
        break;
      case 'notifications':
        Alert.alert('Notifications', 'Notification settings coming soon.');
        break;
      case 'units':
        Alert.alert('Units', 'Unit preferences coming soon.');
        break;
      case 'health':
        Alert.alert('Apple Health', 'Apple Health integration coming soon.');
        break;
      case 'privacy':
        Alert.alert('Privacy Policy', 'Privacy policy will open in browser.');
        break;
      case 'terms':
        Alert.alert('Terms of Service', 'Terms will open in browser.');
        break;
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            // Clear all user data from every store so the next user starts fresh
            clearProfile();
            clearEntries();
            clearHistory();
            clearRecovery();
            clearAI();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  };

  const planLabel = isPro ? 'PRO' : 'FREE';
  const planColor = isPro ? colors.accent.primary : colors.text.tertiary;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Profile</Text>
      </View>

      {/* ── Avatar ── */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={{ fontSize: 32 }}>👤</Text>
          </View>
          <TouchableOpacity style={styles.editBadge} onPress={() => Alert.alert('Edit Photo', 'Photo upload coming soon.')}>
            <Text style={{ fontSize: 12 }}>✏️</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>{profile?.name ?? user?.email ?? 'Novra User'}</Text>
        <TouchableOpacity
          style={[styles.planBadge, { borderColor: planColor + '40' }]}
          onPress={() => !isPro && router.push('/paywall')}
        >
          <Text style={[styles.planBadgeText, { color: planColor }]}>{planLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Stats Row ── */}
      <View style={styles.statsRow}>
        {([
          [profile?.weight_kg ? `${profile.weight_kg} kg` : '—', 'Weight'],
          [profile?.height_cm ? `${profile.height_cm} cm` : '—', 'Height'],
          [profile?.bmi       ? String(profile.bmi)        : '—', 'BMI'],
        ] as [string, string][]).map(([val, label]) => (
          <View key={label} style={styles.statCard}>
            <Text style={styles.statVal}>{val}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── Novra Score (shared hook — always matches Home screen) ── */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreLeft}>
          <Text style={[styles.scoreNum, { color: scoreColor }]}>{score}</Text>
          <View>
            <Text style={styles.scoreTitle}>Novra Score</Text>
            <Text style={[styles.scoreSub, { color: deltaColor }]}>vs yesterday  {deltaLabel}</Text>
          </View>
        </View>
        <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
          <Text style={[styles.scoreRingNum, { color: scoreColor }]}>{score}</Text>
        </View>
      </View>

      {/* ── Settings ── */}
      <View style={styles.settingsCard}>
        {SETTINGS.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.settingRow, i === SETTINGS.length - 1 && { borderBottomWidth: 0 }]}
            onPress={() => handleSetting(item.action)}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <Text style={{ fontSize: 18 }}>{item.icon}</Text>
              <Text style={styles.settingLabel}>{item.label}</Text>
            </View>
            <View style={styles.settingRight}>
              {item.sub ? <Text style={styles.settingSub}>{item.sub}</Text> : null}
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Sign Out ── */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.75}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Novra Health v1.0.0</Text>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.base },

  header:    { paddingTop: 52, marginBottom: spacing.xl },
  pageTitle: { fontFamily: typography.fonts.display, fontSize: typography.sizes['2xl'], color: colors.text.primary },

  profileHeader: { alignItems: 'center', marginBottom: spacing.xl },
  avatarWrap:    { position: 'relative', marginBottom: spacing.sm },
  avatar:        { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.bg.elevated, borderWidth: 2, borderColor: colors.accent.primary + '60', alignItems: 'center', justifyContent: 'center' },
  editBadge:     { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.bg.tertiary, borderWidth: 1, borderColor: colors.border.default, alignItems: 'center', justifyContent: 'center' },
  name:          { fontFamily: typography.fonts.heading, fontSize: typography.sizes.xl, color: colors.text.primary, marginBottom: spacing.xs },
  planBadge:     { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 5 },
  planBadgeText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs },

  statsRow:  { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base },
  statCard:  { flex: 1, backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.lg, padding: spacing.base, alignItems: 'center', gap: 3 },
  statVal:   { fontFamily: typography.fonts.display, fontSize: typography.sizes.xl, color: colors.text.primary },
  statLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.secondary },

  scoreCard:    { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.accent.primary + '20', borderRadius: radius.xl, padding: spacing.base, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base },
  scoreLeft:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreNum:     { fontFamily: typography.fonts.display, fontSize: typography.sizes['3xl'] },
  scoreTitle:   { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  scoreSub:     { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
  scoreRing:    { width: 54, height: 54, borderRadius: 27, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  scoreRingNum: { fontFamily: typography.fonts.display, fontSize: typography.sizes.md },

  settingsCard: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, marginBottom: spacing.base, overflow: 'hidden' },
  settingRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: spacing.base, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  settingLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  settingLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.base, color: colors.text.primary },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  settingSub:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary },
  chevron:      { fontFamily: typography.fonts.body, fontSize: typography.sizes.lg, color: colors.text.tertiary },

  signOutBtn:  { paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm },
  signOutText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.status.danger },
  version:     { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.sm },
});

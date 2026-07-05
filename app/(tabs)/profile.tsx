import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform, TextInput, KeyboardAvoidingView, Image, Switch, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const HEALTH_APP = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { useWeightLogStore } from '../../stores/weightLogStore';
import { useZenovaScore, formatDeltaLabel } from '../../hooks/useZenovaScore';
import { colors, withAlpha, bmiColor } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { elevation } from '../../constants/elevation';
import { MEDICAL_DISCLAIMER } from '../../constants/legal';
import { isValidHeightCm, isValidWeightKg } from '../../services/recommendations';
import {
  Icon, Bell, ChartColumn, Heart, CreditCard, Stethoscope, Lock, FileText,
  Ruler, ChevronRight, CircleUserRound, Pencil, Settings, Trash2,
} from '../../components/ui/Icon';
import { supabase } from '../../services/supabase';
import { logError } from '../../services/monitoring';
import { useT } from '../../constants/i18n';
import { ProgressRing } from '../../components/ui/ProgressRing';

const DELETE_ACCOUNT_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`;

// ── Unit helpers ──────────────────────────────────────────────────────────────
function kgToLbs(kg: number)  { return Math.round(kg * 2.20462); }
function lbsToKg(lbs: number) { return Math.round((lbs / 2.20462) * 10) / 10; }
function cmToInTotal(cm: number) { return Math.round(cm / 2.54); }
function inToCm(totalIn: number) { return Math.round(totalIn * 2.54); }
function cmToFtIn(cm: number) {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn % 12);
  return `${ft}'${inch}"`;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { signOut, user } = useAuthStore();
  const profile        = useUserStore((s) => s.profile);
  const updateProfile  = useUserStore((s) => s.updateProfile);
  const addWeightEntry = useWeightLogStore((s) => s.addEntry);
  const { plan, isPro, setPlan } = useSubscriptionStore();
  const units = profile?.units ?? 'metric';
  const t = useT();
  const [deleting, setDeleting] = useState(false);

  const SETTINGS = [
    { icon: Bell,        label: t('profile.notifications'), sub: '',                                                        action: 'notifications', pro: false },
    { icon: ChartColumn, label: t('profile.weeklyReport'),  sub: isPro ? t('profile.aiPowered') : '',                       action: 'weeklyReport',  pro: !isPro },
    { icon: Heart,       label: HEALTH_APP,                  sub: t('profile.connect'),                                      action: 'health',        pro: false },
    { icon: CreditCard,  label: t('profile.subscription'),  sub: plan === 'free' ? t('profile.freePlan') : plan.toUpperCase(), action: 'subscription', pro: false },
    { icon: Stethoscope, label: t('profile.healthDisclaimer'), sub: t('profile.notMedicalAdvice'),                          action: 'disclaimer',    pro: false },
    { icon: Lock,        label: t('profile.privacyPolicy'), sub: '',                                                        action: 'privacy',       pro: false },
    { icon: FileText,    label: t('profile.termsOfService'), sub: '',                                                       action: 'terms',         pro: false },
  ];

  const { score, scoreColor, delta, deltaColor } = useZenovaScore();
  const deltaLabel = formatDeltaLabel(delta, t('score.sameAsYesterday'));

  // ── Edit state ──
  const [editing, setEditing] = useState(false);
  const [draftName,   setDraftName]   = useState('');
  const [draftWeight, setDraftWeight] = useState('');
  const [draftHeight, setDraftHeight] = useState('');

  const openEdit = () => {
    setDraftName(profile?.name ?? '');
    if (units === 'imperial') {
      setDraftWeight(profile?.weight_kg ? String(kgToLbs(profile.weight_kg)) : '');
      setDraftHeight(profile?.height_cm ? String(cmToInTotal(profile.height_cm)) : '');
    } else {
      setDraftWeight(profile?.weight_kg ? String(profile.weight_kg) : '');
      setDraftHeight(profile?.height_cm ? String(profile.height_cm) : '');
    }
    setEditing(true);
  };

  const saveEdit = () => {
    const name = draftName.trim() || undefined;
    const rawW = parseFloat(draftWeight) || undefined;
    const rawH = parseFloat(draftHeight) || undefined;
    const weight_kg = rawW ? (units === 'imperial' ? lbsToKg(rawW) : rawW) : undefined;
    const height_cm = rawH ? (units === 'imperial' ? inToCm(rawH)  : rawH) : undefined;
    // Validate in metric after unit conversion — implausible values corrupt
    // BMI/TDEE targets everywhere downstream (finding F13).
    if ((weight_kg !== undefined && !isValidWeightKg(weight_kg)) ||
        (height_cm !== undefined && !isValidHeightCm(height_cm))) {
      Alert.alert(t('common.error'), t('profile.rangeError'));
      return;
    }
    const bmi = (weight_kg && height_cm)
      ? parseFloat((weight_kg / Math.pow(height_cm / 100, 2)).toFixed(1))
      : profile?.bmi;
    updateProfile({ name, weight_kg, height_cm, bmi });
    // Log weight change to history
    if (weight_kg) addWeightEntry(weight_kg);
    setEditing(false);
  };

  const handleSetting = (action: string) => {
    switch (action) {
      case 'subscription':
        router.push('/paywall');
        break;
      case 'notifications':
        router.push('/modals/notifications');
        break;
      case 'weeklyReport':
        if (!isPro) { router.push('/paywall'); return; }
        router.push('/modals/weekly-report');
        break;
      case 'health':
        Alert.alert(HEALTH_APP, t('profile.healthIntegration', { app: HEALTH_APP }));
        break;
      case 'disclaimer':
        Alert.alert(t('profile.healthDisclaimer'), MEDICAL_DISCLAIMER);
        break;
      case 'privacy':
        Linking.openURL('https://zenovaapp.com/privacy');
        break;
      case 'terms':
        Linking.openURL('https://zenovaapp.com/terms');
        break;
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      t('profile.signOut'),
      t('profile.signOutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.signOut'),
          style: 'destructive',
          onPress: async () => {
            // signOut() clears all persisted stores internally (authStore.ts).
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  };

  // Store-mandated account deletion (Apple 5.1.1(v), Google Play policy):
  // double confirm, then the delete-account edge fn removes the auth user —
  // all user tables cascade from auth.users, so server data goes with it.
  const handleDeleteAccount = () => {
    Alert.alert(
      t('profile.deleteAccount'),
      t('profile.deleteAccountConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.continue'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('profile.deleteAccountFinalTitle'),
              t('profile.deleteAccountFinalBody'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('profile.deleteAccount'),
                  style: 'destructive',
                  onPress: async () => {
                    if (deleting) return;
                    setDeleting(true);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session) throw new Error('no session');
                      const res = await fetch(DELETE_ACCOUNT_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                      });
                      if (!res.ok) throw new Error(`delete-account HTTP ${res.status}`);
                      // The auth user is gone server-side; signOut's own server
                      // call may 4xx — the local store cleanup is what matters.
                      await signOut().catch(() => {});
                      router.replace('/(auth)/login');
                    } catch (e) {
                      logError(e, { where: 'profile.deleteAccount' });
                      Alert.alert(t('common.error'), t('profile.deleteAccountError'));
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const planLabel = isPro ? t('common.pro') : t('common.free');
  const planColor = isPro ? colors.accent.primary : colors.text.tertiary;

  const computedBmi = (() => {
    const raw_w = parseFloat(draftWeight);
    const raw_h = parseFloat(draftHeight);
    if (!raw_w || !raw_h) return null;
    const w = units === 'imperial' ? lbsToKg(raw_w) : raw_w;
    const h = units === 'imperial' ? inToCm(raw_h)  : raw_h;
    if (w > 0 && h > 0) return (w / Math.pow(h / 100, 2)).toFixed(1);
    return null;
  })();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <Text style={styles.pageTitle}>{t('profile.title')}</Text>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={editing ? saveEdit : openEdit}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={editing ? t('profile.save') : t('profile.edit')}
          >
            <Text style={styles.editBtnText}>{editing ? t('profile.save') : t('profile.edit')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Avatar ── */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              {profile?.avatar
                ? <Image source={{ uri: profile.avatar }} style={styles.avatarImage} />
                : <Icon icon={CircleUserRound} size={32} color={colors.accent.primary} />}
            </View>
            <TouchableOpacity
              style={styles.editBadge}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('profile.changePhoto')}
              onPress={async () => {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert(t('common.permissionNeeded'), t('profile.photoPermission'));
                  return;
                }
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  allowsEditing: true,
                  aspect: [1, 1],
                  quality: 0.7,
                });
                if (!result.canceled && result.assets[0]?.uri) {
                  updateProfile({ avatar: result.assets[0].uri });
                }
              }}
            >
              <Icon icon={Pencil} size={12} color={colors.bg.secondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {editing ? (
            <TextInput
              style={styles.nameInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder={t('profile.yourName')}
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="words"
              returnKeyType="done"
            />
          ) : (
            <Text style={styles.name}>{profile?.name ?? user?.email ?? t('profile.defaultUser')}</Text>
          )}

          <TouchableOpacity
            style={[styles.planBadge, { borderColor: withAlpha(planColor, 0.25) }]}
            onPress={() => !isPro && router.push('/paywall')}
            accessibilityRole="button"
            accessibilityLabel={isPro ? t('profile.currentPlan', { plan: planLabel }) : t('profile.currentPlanUpgrade', { plan: planLabel })}
          >
            <Text style={[styles.planBadgeText, { color: planColor }]}>{planLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats Row ── */}
        {editing ? (
          <View style={styles.editStatsRow}>
            <View style={styles.editStatField}>
              <Text style={styles.editStatLabel}>{units === 'imperial' ? t('profile.weightLbs') : t('profile.weightKg')}</Text>
              <TextInput
                style={styles.editStatInput}
                value={draftWeight}
                onChangeText={setDraftWeight}
                placeholder={units === 'imperial' ? '154' : '70'}
                placeholderTextColor={colors.text.tertiary}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>
            <View style={styles.editStatField}>
              <Text style={styles.editStatLabel}>{units === 'imperial' ? t('profile.heightIn') : t('profile.heightCm')}</Text>
              <TextInput
                style={styles.editStatInput}
                value={draftHeight}
                onChangeText={setDraftHeight}
                placeholder={units === 'imperial' ? '69' : '175'}
                placeholderTextColor={colors.text.tertiary}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>
            <View style={[styles.editStatField, { opacity: 0.65 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.editStatLabel}>{t('profile.bmi')}</Text>
                <View style={styles.autoTag}><Text style={styles.autoTagText}>{t('profile.auto')}</Text></View>
              </View>
              <View style={[styles.editStatInput, styles.editStatReadonly]}>
                <Text style={styles.editStatReadonlyText}>{computedBmi ?? '—'}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statVal}>
                {profile?.weight_kg
                  ? units === 'imperial' ? `${kgToLbs(profile.weight_kg)} lbs` : `${profile.weight_kg} kg`
                  : '—'}
              </Text>
              <Text style={styles.statLabel}>{t('profile.weight')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statVal}>
                {profile?.height_cm
                  ? units === 'imperial' ? cmToFtIn(profile.height_cm) : `${profile.height_cm} cm`
                  : '—'}
              </Text>
              <Text style={styles.statLabel}>{t('profile.height')}</Text>
            </View>
            <View style={styles.statCard}>
              {(() => {
                const bmi = profile?.bmi;
                const color = bmi ? bmiColor(bmi) : colors.text.primary;
                const bmiLabel = !bmi ? null
                  : bmi < 18.5 ? t('profile.bmiUnderweight')
                  : bmi < 25   ? t('profile.bmiNormal')
                  : bmi < 30   ? t('profile.bmiOverweight')
                  : t('profile.bmiObese');
                return (
                  <>
                    <Text style={[styles.statVal, { color }]}>{bmi ? String(bmi) : '—'}</Text>
                    <Text style={styles.statLabel}>{t('profile.bmi')}</Text>
                    {bmiLabel && <Text style={[styles.bmiTag, { color, borderColor: withAlpha(color, 0.25) }]}>{bmiLabel}</Text>}
                  </>
                );
              })()}
            </View>
          </View>
        )}

        {/* ── Cancel button when editing ── */}
        {editing && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => setEditing(false)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('profile.cancelEditing')}
          >
            <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        )}

        {/* ── Zenova Score ── */}
        {!editing && (
          <View style={styles.scoreCard}>
            <View style={styles.scoreLeft}>
              <Text style={[styles.scoreNum, { color: scoreColor }]}>{score}</Text>
              <View>
                <Text style={styles.scoreTitle}>{t('profile.lifeScore')}</Text>
                <Text style={[styles.scoreSub, { color: deltaColor }]}>{t('profile.vsYesterday', { delta: deltaLabel })}</Text>
              </View>
            </View>
            <ProgressRing progress={score / 100} size={54} strokeWidth={5} color={scoreColor}>
              <Text style={[styles.scoreRingNum, { color: scoreColor }]}>{score}</Text>
            </ProgressRing>
          </View>
        )}

        {/* ── Settings ── */}
        {!editing && (
          <View style={styles.settingsCard}>
            {/* Units toggle row */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Icon icon={Ruler} size="md" color={colors.text.secondary} />
                <View>
                  <Text style={styles.settingLabel}>{t('profile.units')}</Text>
                  <Text style={styles.settingSubSmall}>{units === 'imperial' ? t('profile.unitsImperial') : t('profile.unitsMetric')}</Text>
                </View>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.settingSub}>{units === 'imperial' ? t('profile.imperial') : t('profile.metric')}</Text>
                <Switch
                  value={units === 'imperial'}
                  onValueChange={(val) => updateProfile({ units: val ? 'imperial' : 'metric' })}
                  trackColor={{ false: colors.border.subtle, true: withAlpha(colors.accent.primary, 0.5) }}
                  thumbColor={units === 'imperial' ? colors.accent.primary : colors.text.tertiary}
                />
              </View>
            </View>

            {SETTINGS.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.settingRow, i === SETTINGS.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => handleSetting(item.action)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}${item.pro ? ', Pro feature' : ''}`}
              >
                <View style={styles.settingLeft}>
                  <Icon icon={item.icon} size="md" color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>{item.label}</Text>
                </View>
                <View style={styles.settingRight}>
                  {item.pro && (
                    <View style={styles.proTag}><Text style={styles.proTagText}>PRO</Text></View>
                  )}
                  {item.sub ? <Text style={styles.settingSub}>{item.sub}</Text> : null}
                  <Icon icon={ChevronRight} size="sm" color={colors.text.tertiary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Sign Out ── */}
        {!editing && (
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={t('profile.signOut')}
          >
            <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
          </TouchableOpacity>
        )}

        {/* ── Delete Account (store-mandated) ── */}
        {!editing && (
          <TouchableOpacity
            style={styles.deleteAccountBtn}
            onPress={handleDeleteAccount}
            disabled={deleting}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={t('profile.deleteAccount')}
          >
            <Icon icon={Trash2} size="sm" color={colors.status.danger} />
            <Text style={styles.deleteAccountText}>
              {deleting ? t('profile.deletingAccount') : t('profile.deleteAccount')}
            </Text>
          </TouchableOpacity>
        )}

        {__DEV__ && (
          <TouchableOpacity
            style={styles.devToggle}
            onPress={() => {
              const next = plan === 'free' ? 'pro' : plan === 'pro' ? 'elite' : 'free';
              setPlan(next);
            }}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon icon={Settings} size="sm" color={colors.text.secondary} />
              <Text style={styles.devToggleText}>DEV: {plan.toUpperCase()} → tap to cycle</Text>
            </View>
          </TouchableOpacity>
        )}

        <Text style={styles.version}>{t('profile.version')}{plan !== 'free' ? `  [${plan.toUpperCase()}]` : ''}</Text>
        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.base },

  header:    { marginBottom: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontFamily: typography.fonts.display, fontSize: typography.sizes['2xl'], color: colors.text.primary },
  editBtn:   { backgroundColor: colors.accent.dim, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.25), borderRadius: radius.full, paddingHorizontal: 18, paddingVertical: 8 },
  editBtnText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.accent.primary },

  profileHeader: { alignItems: 'center', marginBottom: spacing.xl },
  avatarWrap:    { position: 'relative', marginBottom: spacing.sm },
  avatar:        { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.bg.elevated, borderWidth: 2, borderColor: withAlpha(colors.accent.primary, 0.38), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage:   { width: 84, height: 84, borderRadius: 42 },
  editBadge:     { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.bg.tertiary, borderWidth: 1, borderColor: colors.border.default, alignItems: 'center', justifyContent: 'center' },
  name:          { fontFamily: typography.fonts.heading, fontSize: typography.sizes.xl, color: colors.text.primary, marginBottom: spacing.xs },
  nameInput:     { fontFamily: typography.fonts.heading, fontSize: typography.sizes.xl, color: colors.text.primary, borderBottomWidth: 1.5, borderBottomColor: colors.accent.primary, textAlign: 'center', paddingVertical: 4, minWidth: 160, marginBottom: spacing.xs },
  planBadge:     { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 5 },
  planBadgeText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs },

  statsRow:  { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base },
  statCard:  { flex: 1, backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.base, alignItems: 'center', gap: 3, ...elevation.card },
  statVal:   { fontFamily: typography.fonts.mono, fontSize: typography.sizes.lg, color: colors.text.primary },
  statLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.secondary },
  bmiTag:    { fontFamily: typography.fonts.body, fontSize: 9, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 1, marginTop: 2 },

  editStatsRow:  { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  editStatField: { flex: 1, backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.19), borderRadius: radius.xl, padding: spacing.sm, alignItems: 'center', gap: 4 },
  editStatLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.secondary },
  editStatInput: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.md, color: colors.text.primary, borderBottomWidth: 1, borderBottomColor: withAlpha(colors.accent.primary, 0.38), textAlign: 'center', width: '100%', paddingVertical: 2 },
  editStatReadonly: { borderBottomWidth: 0, alignItems: 'center', justifyContent: 'center' },
  editStatReadonlyText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.md, color: colors.text.tertiary },
  autoTag:     { backgroundColor: colors.bg.elevated, borderRadius: radius.sm, paddingHorizontal: 5, paddingVertical: 1 },
  autoTagText: { fontFamily: typography.fonts.body, fontSize: 9, color: colors.text.tertiary },

  cancelBtn:     { alignItems: 'center', paddingVertical: spacing.sm, marginBottom: spacing.base },
  cancelBtnText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.base, color: colors.text.tertiary },

  scoreCard:    { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.13), borderRadius: radius.xl, padding: spacing.base, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base, ...elevation.card },
  scoreLeft:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreNum:     { fontFamily: typography.fonts.mono, fontSize: typography.sizes['3xl'] },
  scoreTitle:   { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  scoreSub:     { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
  scoreRingNum: { fontFamily: typography.fonts.mono, fontSize: typography.sizes.md },

  settingsCard: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, marginBottom: spacing.base, overflow: 'hidden', ...elevation.card },
  settingRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: spacing.base, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  settingLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  settingLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.base, color: colors.text.primary },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  settingSub:     { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary },
  settingSubSmall: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 1 },
  proTag:       { backgroundColor: colors.accent.dim, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  proTagText:   { fontFamily: typography.fonts.bodyMed, fontSize: 10, color: colors.accent.primary },

  signOutBtn:  { paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm },
  signOutText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.status.danger },
  deleteAccountBtn:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 14 },
  deleteAccountText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.status.danger },
  version:       { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.sm },
  devToggle:     { backgroundColor: colors.bg.elevated, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: spacing.xl, alignSelf: 'center', marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border.default },
  devToggleText: { fontFamily: typography.fonts.mono, fontSize: typography.sizes.xs, color: colors.text.secondary },
});

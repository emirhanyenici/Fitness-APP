import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Pressable } from 'react-native';
import { Icon, Eye, EyeOff, Check } from '../../components/ui/Icon';
import { secureStorage } from '../../services/secureStorage';
import { router, useRootNavigationState } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { supabase } from '../../services/supabase';
import { colors, withAlpha } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { elevation } from '../../constants/elevation';
import { Button } from '../../components/ui/Button';
import { useAnalytics } from '../../services/analytics';
import { useT } from '../../constants/i18n';

const SAVED_EMAIL_KEY = 'zenova_saved_email';

export default function LoginScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: 'email' | 'password' | 'confirm' | 'general'; msg: string } | null>(null);

  const { signIn, signUp, isLoading } = useAuthStore();
  const session = useAuthStore((s) => s.session);
  const isOnboarded = useUserStore((s) => s.isOnboarded);
  const analytics = useAnalytics();
  const t = useT();
  const isSignUp = mode === 'signup';

  // Set once the user starts an interactive sign-in/sign-up — the auto-redirect
  // below must not race handleSubmit's own (server-aware) navigation.
  const interactiveAuth = useRef(false);

  useEffect(() => {
    secureStorage.getItem(SAVED_EMAIL_KEY).then((saved) => {
      if (saved) { setEmail(saved); setRememberMe(true); setMode('signin'); }
    });
  }, []);

  // Navigating before the root navigator mounts (hot reload / error-boundary
  // remount) throws "Attempted to navigate before mounting the Root Layout".
  // Gate the auto-redirect on navigation readiness; the effect re-runs once ready.
  const navState = useRootNavigationState();

  // F9 recovery path: if a restored session appears while this screen is up
  // (late hydration, or the index gate timed out before storage answered),
  // route the user back in instead of stranding them on the login form.
  useEffect(() => {
    if (!navState?.key || !session || interactiveAuth.current) return;
    const serverOnboarded = session.user?.user_metadata?.onboarding_completed === true;
    router.replace(serverOnboarded || isOnboarded ? '/(tabs)' : '/(onboarding)/welcome');
  }, [navState?.key, session, isOnboarded]);

  const handleSubmit = async () => {
    interactiveAuth.current = true;
    setFieldError(null);
    if (!email.trim()) {
      setFieldError({ field: 'email', msg: t('auth.emailRequired') }); return;
    }
    if (!password.trim()) {
      setFieldError({ field: 'password', msg: t('auth.passwordRequired') }); return;
    }
    if (isSignUp && password.length < 12) {
      setFieldError({ field: 'password', msg: t('auth.passwordMin') }); return;
    }
    if (isSignUp && !/[A-Z]/.test(password)) {
      setFieldError({ field: 'password', msg: t('auth.passwordUpper') }); return;
    }
    if (isSignUp && !/[0-9]/.test(password)) {
      setFieldError({ field: 'password', msg: t('auth.passwordNumber') }); return;
    }
    if (isSignUp && password !== confirmPassword) {
      setFieldError({ field: 'confirm', msg: t('auth.passwordsNoMatch') }); return;
    }
    try {
      if (isSignUp) {
        const hasSession = await signUp(email.trim(), password);
        analytics.signedUp('email');
        if (hasSession) {
          // Email confirmation is disabled — the account is live, go straight
          // to onboarding like a fresh sign-in would. Read the session from
          // supabase directly: the store's onAuthStateChange listener may not
          // have fired yet.
          const { data: { session: freshSession } } = await supabase.auth.getSession();
          const userId = freshSession?.user?.id;
          if (userId) analytics.identify(userId, email.trim());
          if (rememberMe) {
            await secureStorage.setItem(SAVED_EMAIL_KEY, email.trim());
          }
          router.replace('/(onboarding)/welcome');
        } else {
          // Confirmation still enabled server-side — keep the legacy flow.
          Alert.alert(t('auth.accountCreated'), t('auth.accountCreatedBody'), [
            { text: t('common.ok'), onPress: () => setMode('signin') },
          ]);
        }
      } else {
        await signIn(email.trim(), password);
        analytics.signedIn('email');
        // Identify the user in PostHog for session tracking
        const userId = useAuthStore.getState().user?.id;
        if (userId) analytics.identify(userId, email.trim());
        if (rememberMe) {
          await secureStorage.setItem(SAVED_EMAIL_KEY, email.trim());
        } else {
          await secureStorage.removeItem(SAVED_EMAIL_KEY);
        }
        // Check server-side onboarding flag so returning users skip onboarding after sign-out
        const { data: { session: freshSession } } = await supabase.auth.getSession();
        const serverOnboarded = freshSession?.user?.user_metadata?.onboarding_completed === true;
        if (serverOnboarded && !isOnboarded) {
          useUserStore.getState().updateProfile({ onboarding_completed: true });
        }
        router.replace(serverOnboarded || isOnboarded ? '/(tabs)' : '/(onboarding)/welcome');
      }
    } catch (e: any) {
      setFieldError({ field: 'general', msg: e.message ?? t('auth.somethingWrong') });
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(t('auth.enterEmail'), t('auth.enterEmailBody'));
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'zenova-lifescore://reset-password',
      });
      if (error) throw error;
      Alert.alert(t('auth.emailSent'), t('auth.resetLinkSent', { email: email.trim() }));
    } catch (e: any) {
      const msg = e.message ?? t('auth.unknownError');
      const hint = msg.toLowerCase().includes('sending')
        ? t('auth.smtpHint')
        : msg;
      Alert.alert(t('common.error'), hint);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Logo */}
      <View style={styles.logoWrap}>
        <Text style={styles.logo}>ZENOVA</Text>
        <View style={styles.logoLine} />
      </View>

      {/* Mode toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, !isSignUp && styles.modeBtnActive]}
          onPress={() => setMode('signin')}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: !isSignUp }}
          accessibilityLabel={t('auth.signInTab')}
        >
          <Text style={[styles.modeBtnText, !isSignUp && styles.modeBtnTextActive]}>{t('auth.signIn')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, isSignUp && styles.modeBtnActive]}
          onPress={() => setMode('signup')}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: isSignUp }}
          accessibilityLabel={t('auth.createAccountTab')}
        >
          <Text style={[styles.modeBtnText, isSignUp && styles.modeBtnTextActive]}>{t('auth.createAccount')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sub}>
        {isSignUp ? t('auth.signUpSub') : t('auth.signInSub')}
      </Text>

      <View style={{ height: spacing.xl }} />

      <TextInput
        style={[styles.input, fieldError?.field === 'email' && styles.inputError]}
        placeholder={t('auth.email')}
        placeholderTextColor={colors.text.tertiary}
        value={email}
        onChangeText={(v) => { setEmail(v); setFieldError(null); }}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      {fieldError?.field === 'email' && <Text style={styles.inlineError}>{fieldError.msg}</Text>}
      <View style={{ height: spacing.sm }} />
      <View style={[styles.pwWrap, fieldError?.field === 'password' && styles.inputError]}>
        <TextInput
          style={styles.pwInput}
          placeholder={t('auth.password')}
          placeholderTextColor={colors.text.tertiary}
          value={password}
          onChangeText={(v) => { setPassword(v); setFieldError(null); }}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
        <Pressable
          style={styles.pwEye}
          onPress={() => setShowPassword((v) => !v)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
        >
          <Icon icon={showPassword ? EyeOff : Eye} size="md" color={colors.text.tertiary} />
        </Pressable>
      </View>
      {fieldError?.field === 'password' && <Text style={styles.inlineError}>{fieldError.msg}</Text>}
      {isSignUp && (
        <>
          <View style={{ height: spacing.sm }} />
          <View style={[styles.pwWrap, fieldError?.field === 'confirm' && styles.inputError]}>
            <TextInput
              style={styles.pwInput}
              placeholder={t('auth.confirmPassword')}
              placeholderTextColor={colors.text.tertiary}
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); setFieldError(null); }}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
            />
            <Pressable
              style={styles.pwEye}
              onPress={() => setShowConfirm((v) => !v)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={showConfirm ? t('auth.hideConfirm') : t('auth.showConfirm')}
            >
              <Icon icon={showConfirm ? EyeOff : Eye} size="md" color={colors.text.tertiary} />
            </Pressable>
          </View>
          {fieldError?.field === 'confirm' && <Text style={styles.inlineError}>{fieldError.msg}</Text>}
        </>
      )}
      {fieldError?.field === 'general' && (
        <View style={styles.generalErrorBox}>
          <Text style={styles.generalErrorText}>{fieldError.msg}</Text>
        </View>
      )}

      {/* Remember me + Forgot password row */}
      {!isSignUp && (
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRememberMe((v) => !v)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: rememberMe }}
            accessibilityLabel={t('auth.rememberMe')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
              {rememberMe && <Icon icon={Check} size={13} color={colors.text.inverse} strokeWidth={3} />}
            </View>
            <Text style={styles.rememberText}>{t('auth.rememberMe')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleForgotPassword}
            disabled={resetLoading}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('auth.forgotPassword')}
          >
            <Text style={styles.forgotText}>{resetLoading ? t('auth.sending') : t('auth.forgotPassword')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: spacing.xl }} />

      <Button
        label={isSignUp ? t('auth.createAccountBtn') : t('auth.signInBtn')}
        onPress={handleSubmit}
        loading={isLoading}
        accessibilityLabel={isSignUp ? t('auth.createAccount') : t('auth.signIn')}
      />

      <View style={{ height: spacing.base }} />

      <TouchableOpacity
        onPress={() => router.canGoBack() ? router.back() : router.replace('/(onboarding)/welcome')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('auth.goBack')}
      >
        <Text style={styles.back}>{t('auth.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.primary },
  container: { padding: spacing['2xl'], justifyContent: 'center', flexGrow: 1, paddingTop: 80 },

  logoWrap: { alignItems: 'center', marginBottom: spacing['2xl'] },
  logo: { fontFamily: typography.fonts.display, fontSize: typography.sizes['3xl'], color: colors.text.primary, letterSpacing: 6 },
  logoLine: { width: 60, height: 2, backgroundColor: colors.accent.primary, borderRadius: 1, marginTop: spacing.sm },

  modeToggle: { flexDirection: 'row', backgroundColor: colors.bg.tertiary, borderRadius: radius.full, padding: 3, marginBottom: spacing.base },
  modeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.full },
  modeBtnActive: { backgroundColor: colors.bg.secondary, ...elevation.card },
  modeBtnText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.tertiary },
  modeBtnTextActive: { color: colors.text.primary },

  sub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, textAlign: 'center', lineHeight: 20 },

  input: {
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    color: colors.text.primary,
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.base,
  },

  pwWrap:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default, borderRadius: radius.lg },
  pwInput:   { flex: 1, paddingHorizontal: spacing.base, paddingVertical: 14, color: colors.text.primary, fontFamily: typography.fonts.body, fontSize: typography.sizes.base },
  pwEye:     { paddingHorizontal: spacing.sm, paddingVertical: 14, justifyContent: 'center', alignItems: 'center' },

  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border.default, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.elevated },
  checkboxActive: { borderColor: colors.accent.primary, backgroundColor: colors.accent.primary },
  rememberText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary },
  forgotText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.accent.primary },

  back: { fontFamily: typography.fonts.body, fontSize: typography.sizes.base, color: colors.text.tertiary, textAlign: 'center' },
  inputError:      { borderColor: withAlpha(colors.status.danger, 0.5) },
  inlineError:     { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.status.danger, marginTop: 4, marginLeft: 4 },
  generalErrorBox: { backgroundColor: withAlpha(colors.status.danger, 0.06), borderWidth: 1, borderColor: withAlpha(colors.status.danger, 0.25), borderRadius: radius.lg, padding: spacing.sm, marginTop: spacing.sm },
  generalErrorText:{ fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.status.danger, textAlign: 'center' },
});

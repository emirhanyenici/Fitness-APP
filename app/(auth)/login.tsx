import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { secureStorage } from '../../services/secureStorage';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { supabase } from '../../services/supabase';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { useAnalytics } from '../../services/analytics';

const SAVED_EMAIL_KEY = 'novra_saved_email';

export default function LoginScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const { signIn, signUp, isLoading } = useAuthStore();
  const isOnboarded = useUserStore((s) => s.isOnboarded);
  const analytics = useAnalytics();
  const isSignUp = mode === 'signup';

  useEffect(() => {
    secureStorage.getItem(SAVED_EMAIL_KEY).then((saved) => {
      if (saved) { setEmail(saved); setRememberMe(true); setMode('signin'); }
    });
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    if (isSignUp && password.length < 12) {
      Alert.alert('Password too short', 'Password must be at least 12 characters.');
      return;
    }
    if (isSignUp && !/[A-Z]/.test(password)) {
      Alert.alert('Weak password', 'Include at least one uppercase letter.');
      return;
    }
    if (isSignUp && !/[0-9]/.test(password)) {
      Alert.alert('Weak password', 'Include at least one number.');
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please make sure both passwords are the same.');
      return;
    }
    try {
      if (isSignUp) {
        await signUp(email.trim(), password);
        analytics.signedUp('email');
        Alert.alert('Account created!', 'Check your email to confirm your account, then sign in.', [
          { text: 'OK', onPress: () => setMode('signin') },
        ]);
      } else {
        await signIn(email.trim(), password);
        analytics.signedIn('email');
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
      Alert.alert(isSignUp ? 'Sign up failed' : 'Sign in failed', e.message);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Type your email address above, then tap Forgot Password.');
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'novra-health://reset-password',
      });
      if (error) throw error;
      Alert.alert('Email sent', `A password reset link has been sent to ${email.trim()}.`);
    } catch (e: any) {
      const msg = e.message ?? 'Unknown error';
      const hint = msg.toLowerCase().includes('sending')
        ? 'Email could not be sent. Check Supabase → Authentication → URL Configuration and ensure SMTP is configured.'
        : msg;
      Alert.alert('Error', hint);
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
        <Text style={styles.logo}>NOVRA</Text>
        <View style={styles.logoLine} />
      </View>

      {/* Mode toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, !isSignUp && styles.modeBtnActive]}
          onPress={() => setMode('signin')}
          activeOpacity={0.8}
        >
          <Text style={[styles.modeBtnText, !isSignUp && styles.modeBtnTextActive]}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, isSignUp && styles.modeBtnActive]}
          onPress={() => setMode('signup')}
          activeOpacity={0.8}
        >
          <Text style={[styles.modeBtnText, isSignUp && styles.modeBtnTextActive]}>Create Account</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sub}>
        {isSignUp
          ? 'Create your Novra account to save your progress.'
          : 'Welcome back. Sign in to continue.'}
      </Text>

      <View style={{ height: spacing.xl }} />

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.text.tertiary}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <View style={{ height: spacing.sm }} />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.text.tertiary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {isSignUp && (
        <>
          <View style={{ height: spacing.sm }} />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor={colors.text.tertiary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </>
      )}

      {/* Remember me + Forgot password row */}
      {!isSignUp && (
        <View style={styles.optionsRow}>
          <TouchableOpacity style={styles.rememberRow} onPress={() => setRememberMe((v) => !v)} activeOpacity={0.7}>
            <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
              {rememberMe && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.rememberText}>Remember me</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleForgotPassword} disabled={resetLoading} activeOpacity={0.7}>
            <Text style={styles.forgotText}>{resetLoading ? 'Sending...' : 'Forgot password?'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: spacing.xl }} />

      <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={isLoading} activeOpacity={0.85}>
        <Text style={styles.btnText}>
          {isLoading
            ? (isSignUp ? 'Creating account...' : 'Signing in...')
            : (isSignUp ? 'Create Account →' : 'Sign In →')}
        </Text>
      </TouchableOpacity>

      <View style={{ height: spacing.base }} />

      <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(onboarding)/welcome')} activeOpacity={0.7}>
        <Text style={styles.back}>&#8592; Back</Text>
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
  modeBtnActive: { backgroundColor: colors.bg.secondary, shadowColor: 'rgba(15,23,42,1)', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
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

  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border.default, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.elevated },
  checkboxActive: { borderColor: colors.accent.primary, backgroundColor: colors.accent.primary },
  checkmark: { color: '#fff', fontSize: 11, fontWeight: '700' },
  rememberText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary },
  forgotText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.accent.primary },

  btn: { backgroundColor: colors.accent.primary, borderRadius: radius.full, paddingVertical: 16, alignItems: 'center' },
  btnText: { fontFamily: typography.fonts.display, fontSize: typography.sizes.base, color: colors.text.inverse },
  back: { fontFamily: typography.fonts.body, fontSize: typography.sizes.base, color: colors.text.tertiary, textAlign: 'center' },
});

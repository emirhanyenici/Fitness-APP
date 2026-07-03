import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';

export default function ResetPasswordScreen() {
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);

  const handleReset = async () => {
    if (!password.trim()) {
      Alert.alert('Enter a password', 'Please type your new password.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Make sure both fields are the same.');
      return;
    }
    if (password.length < 12) {
      Alert.alert('Too short', 'Password must be at least 12 characters.');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      Alert.alert('Weak password', 'Include at least one uppercase letter.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      Alert.alert('Weak password', 'Include at least one number.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert('Password updated', 'Your password has been changed. You can now sign in.', [
        { text: 'Sign In', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.logoWrap}>
        <Text style={styles.logo}>ZENOVA</Text>
        <View style={styles.logoLine} />
      </View>

      <Text style={styles.title}>Set New Password</Text>
      <Text style={styles.sub}>Enter a new password for your account.</Text>

      <View style={{ height: spacing.xl }} />

      <TextInput
        style={styles.input}
        placeholder="New Password"
        placeholderTextColor={colors.text.tertiary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <View style={{ height: spacing.sm }} />
      <TextInput
        style={styles.input}
        placeholder="Confirm New Password"
        placeholderTextColor={colors.text.tertiary}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
      />

      <View style={{ height: spacing.xl }} />

      <TouchableOpacity style={styles.btn} onPress={handleReset} disabled={loading} activeOpacity={0.85}>
        <Text style={styles.btnText}>{loading ? 'Updating...' : 'Update Password →'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: colors.bg.primary },
  container: { padding: spacing['2xl'], justifyContent: 'center', flexGrow: 1, paddingTop: 80 },

  logoWrap: { alignItems: 'center', marginBottom: spacing['2xl'] },
  logo:     { fontFamily: typography.fonts.display, fontSize: typography.sizes['3xl'], color: colors.text.primary, letterSpacing: 6 },
  logoLine: { width: 60, height: 2, backgroundColor: colors.accent.primary, borderRadius: 1, marginTop: spacing.sm },

  title: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.xl, color: colors.text.primary, textAlign: 'center', marginBottom: spacing.xs },
  sub:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, textAlign: 'center', lineHeight: 20 },

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
  btn:     { backgroundColor: colors.accent.primary, borderRadius: radius.full, paddingVertical: 16, alignItems: 'center' },
  btnText: { fontFamily: typography.fonts.display, fontSize: typography.sizes.base, color: colors.text.inverse },
});

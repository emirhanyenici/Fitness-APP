import { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { supabase } from '../../services/supabase';
import { isValidHeightCm, isValidWeightKg } from '../../services/recommendations';
import { colors, withAlpha, bmiColors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { useT } from '../../constants/i18n';

/** Returns null when inputs are missing or outside plausible human ranges. */
function calcBMI(weightKg: number, heightCm: number): number | null {
  if (!isValidWeightKg(weightKg) || !isValidHeightCm(heightCm)) return null;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 100) / 100; // 2 decimal places
}

type BmiCat = { labelKey: string; color: string; commentKey: string };

function bmiCategory(bmi: number | null): BmiCat | null {
  if (bmi === null) return null;
  if (bmi < 18.5) return { labelKey: 'onboarding.bmiUnderweight', color: bmiColors.underweight, commentKey: 'onboarding.bmiUnderweightComment' };
  if (bmi < 25)   return { labelKey: 'onboarding.bmiNormal',      color: bmiColors.normal,      commentKey: 'onboarding.bmiNormalComment' };
  if (bmi < 30)   return { labelKey: 'onboarding.bmiOverweight',  color: bmiColors.overweight,  commentKey: 'onboarding.bmiOverweightComment' };
  if (bmi < 35)   return { labelKey: 'onboarding.bmiObese1',      color: bmiColors.obese1,      commentKey: 'onboarding.bmiObese1Comment' };
  return           { labelKey: 'onboarding.bmiObese2',            color: bmiColors.obese2,      commentKey: 'onboarding.bmiObese2Comment' };
}

const STEPS = [
  {
    type: 'chips' as const,
    messageKey: 'onboarding.goalMessage',
    options: [
      { labelKey: 'onboarding.goalLoseWeight', value: 'lose_weight' },
      { labelKey: 'onboarding.goalGainMuscle', value: 'gain_muscle' },
      { labelKey: 'onboarding.goalEnergy',     value: 'improve_energy' },
      { labelKey: 'onboarding.goalSleep',      value: 'better_sleep' },
      { labelKey: 'onboarding.goalStress',     value: 'reduce_stress' },
      { labelKey: 'onboarding.goalGeneral',    value: 'general_health' },
    ],
    key: 'primary_goal',
  },
  {
    type: 'chips' as const,
    messageKey: 'onboarding.sexMessage',
    options: [
      { labelKey: 'onboarding.sexMale',   value: 'male' },
      { labelKey: 'onboarding.sexFemale', value: 'female' },
      { labelKey: 'onboarding.sexOther',  value: 'other' },
    ],
    key: 'gender',
  },
  {
    type: 'bmi' as const,
    messageKey: 'onboarding.bmiMessage',
    key: null,
  },
  {
    type: 'chips' as const,
    messageKey: 'onboarding.freqMessage',
    options: [
      { labelKey: 'onboarding.freqNever', value: '0' },
      { labelKey: 'onboarding.freq12',    value: '2' },
      { labelKey: 'onboarding.freq34',    value: '3' },
      { labelKey: 'onboarding.freq5',     value: '5' },
      { labelKey: 'onboarding.freq67',    value: '6' },
    ],
    key: 'workout_frequency',
  },
  {
    type: 'chips' as const,
    messageKey: 'onboarding.envMessage',
    options: [
      { labelKey: 'onboarding.envGym',  value: 'gym' },
      { labelKey: 'onboarding.envHome', value: 'home' },
    ],
    key: 'workout_environment',
  },
  {
    type: 'chips' as const,
    messageKey: 'onboarding.obstacleMessage',
    options: [
      { labelKey: 'onboarding.obstacleTime',       value: 'no_time' },
      { labelKey: 'onboarding.obstacleMotivation', value: 'low_motivation' },
      { labelKey: 'onboarding.obstacleKnowledge',  value: 'no_knowledge' },
      { labelKey: 'onboarding.obstacleDiet',       value: 'food_discipline' },
    ],
    key: 'main_obstacle',
  },
  {
    type: 'text' as const,
    messageKey: 'onboarding.nameMessage',
    key: 'name',
  },
];

export default function OnboardingChat() {
  const session = useAuthStore((s) => s.session);
  const t = useT();

  useEffect(() => {
    if (!session) router.replace('/(auth)/login');
  }, [session]);

  const [step, setStep]           = useState(0);
  const [answers, setAnswers]     = useState<Record<string, string>>({});
  const [done, setDone]           = useState(false);

  const profile       = useUserStore((s) => s.profile);
  const updateProfile = useUserStore((s) => s.updateProfile);

  // Pre-fill from existing profile data for returning users
  const [height,    setHeight]    = useState(profile?.height_cm ? String(profile.height_cm) : '');
  const [weight,    setWeight]    = useState(profile?.weight_kg ? String(profile.weight_kg) : '');
  const [nameInput, setNameInput] = useState(profile?.name ?? '');

  // BMI is computed live as user types — no separate "Calculate" button
  const liveBmi = useMemo(() => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    return calcBMI(w, h);
  }, [height, weight]);
  const liveCat = useMemo(() => bmiCategory(liveBmi), [liveBmi]);

  const current = STEPS[step];

  const goNext = async (final: Record<string, string>) => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      setDone(true);
      try {
        // Attach Supabase auth id + email so profile is never missing required fields
        const { data: { user } } = await supabase.auth.getUser();
        // Persist onboarding flag server-side so returning users skip onboarding after sign-out
        await supabase.auth.updateUser({ data: { onboarding_completed: true } });
        updateProfile({
          ...final,
          onboarding_completed: true,
          id: user?.id ?? '',
          email: user?.email ?? '',
        });
      } catch (e: any) {
        // Supabase update failed — still complete onboarding locally
        console.warn('[onboarding] Supabase update failed:', e?.message);
        updateProfile({ ...final, onboarding_completed: true });
      }
      setTimeout(() => router.replace('/(tabs)'), 1500);
    }
  };

  const handleChip = (value: string) => {
    const key = (current as { key: string }).key;
    const updated = { ...answers, [key]: value };
    setAnswers(updated);
    goNext(updated);
  };

  const handleNameSubmit = () => {
    const name = nameInput.trim();
    if (!name) return;
    const key = (current as { key: string }).key;
    const updated = { ...answers, [key]: name };
    setAnswers(updated);
    updateProfile({ name });
    goNext(updated);
  };


  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.header}>
          {step > 0 && !done && (
            <TouchableOpacity onPress={() => setStep((s) => Math.max(0, s - 1))} accessibilityRole="button" accessibilityLabel={t('onboarding.goBackStep')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.back}>&#8592;</Text>
            </TouchableOpacity>
          )}
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
            ))}
          </View>
          <Text style={styles.stepLabel}>
            {done ? t('onboarding.complete') : t('onboarding.stepXofY', { n: step + 1, total: STEPS.length })}
          </Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.messageRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>&#10022;</Text></View>
            <View style={styles.bubble}>
              <Text style={styles.bubbleText}>
                {done ? t('onboarding.planPreparing') : t(current.messageKey)}
              </Text>
            </View>
          </View>

          {!done && current.type === 'chips' && (
            <View style={styles.options}>
              {(current as { options: { labelKey: string; value: string }[] }).options.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.chip}
                  onPress={() => handleChip(opt.value)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t(opt.labelKey)}
                >
                  <Text style={styles.chipText}>{t(opt.labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!done && current.type === 'bmi' && (
            <View style={styles.bmiForm}>
              {/* Inputs */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('onboarding.heightCm')}</Text>
                <TextInput
                  style={styles.input}
                  value={height}
                  onChangeText={setHeight}
                  placeholder={t('onboarding.heightEg')}
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="numeric"
                  maxLength={3}
                  accessibilityLabel={t('onboarding.heightA11y')}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('onboarding.weightKg')}</Text>
                <TextInput
                  style={styles.input}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder={t('onboarding.weightEg')}
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="numeric"
                  maxLength={4}
                  accessibilityLabel={t('onboarding.weightA11y')}
                />
              </View>

              {/* Inline range error — both fields filled but implausible */}
              {height !== '' && weight !== '' && liveBmi === null && (
                <Text style={styles.rangeError}>{t('onboarding.rangeError')}</Text>
              )}

              {/* Live BMI preview */}
              {liveBmi !== null && liveCat !== null && (
                <View style={styles.bmiPreview}>
                  <View style={styles.bmiPreviewLeft}>
                    <Text style={[styles.bmiPreviewNum, { color: liveCat.color }]}>{liveBmi}</Text>
                    <Text style={styles.bmiPreviewUnit}>{t('onboarding.bmiUnit')}</Text>
                  </View>
                  <View style={[styles.bmiPreviewBadge, { backgroundColor: withAlpha(liveCat.color, 0.09), borderColor: withAlpha(liveCat.color, 0.25) }]}>
                    <Text style={[styles.bmiPreviewLabel, { color: liveCat.color }]}>{t(liveCat.labelKey)}</Text>
                  </View>
                </View>
              )}

              {/* BMI scale bar */}
              {liveBmi !== null && (
                <View style={styles.bmiScaleRow}>
                  {[
                    { label: t('onboarding.scaleUnder'), range: '<18.5', color: bmiColors.underweight, threshold: 18.5 },
                    { label: t('onboarding.scaleNormal'), range: '18.5–25', color: bmiColors.normal, threshold: 25 },
                    { label: t('onboarding.scaleOver'), range: '25–30', color: bmiColors.overweight, threshold: 30 },
                    { label: t('onboarding.scaleObese'), range: '30+', color: bmiColors.obese2, threshold: Infinity },
                  ].map((r) => {
                    const active = liveBmi !== null && (
                      r.threshold === 18.5 ? liveBmi < 18.5 :
                      r.threshold === 25   ? liveBmi >= 18.5 && liveBmi < 25 :
                      r.threshold === 30   ? liveBmi >= 25   && liveBmi < 30 :
                      liveBmi >= 30
                    );
                    return (
                      <View key={r.label} style={[styles.bmiScaleSeg, active && { borderColor: withAlpha(r.color, 0.5), backgroundColor: withAlpha(r.color, 0.07) }]}>
                        <View style={[styles.bmiScaleDot, { backgroundColor: r.color }]} />
                        <Text style={[styles.bmiScaleLabel, active && { color: r.color, fontFamily: typography.fonts.bodyMed }]}>{r.label}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Comment */}
              {liveCat !== null && (
                <View style={styles.commentBox}>
                  <Text style={styles.commentText}>{t(liveCat.commentKey)}</Text>
                </View>
              )}

              {/* Continue */}
              <TouchableOpacity
                style={[styles.calcBtn, liveBmi === null && styles.calcBtnDisabled]}
                onPress={() => {
                  if (liveBmi === null || liveCat === null) return;
                  const h = parseFloat(height);
                  const w = parseFloat(weight);
                  updateProfile({ height_cm: h, weight_kg: w, bmi: liveBmi });
                  goNext(answers);
                }}
                disabled={liveBmi === null}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ disabled: liveBmi === null }}
                accessibilityLabel={liveBmi !== null ? t('onboarding.continueA11y') : t('onboarding.enterHWA11y')}
              >
                <Text style={styles.calcBtnText}>
                  {liveBmi !== null ? t('onboarding.continueArrow') : t('onboarding.enterHW')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!done && current.type === 'text' && (
            <View style={styles.bmiForm}>
              <TextInput
                style={styles.input}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder={t('onboarding.yourName')}
                placeholderTextColor={colors.text.tertiary}
                maxLength={30}
                autoFocus
                onSubmitEditing={handleNameSubmit}
                returnKeyType="done"
                accessibilityLabel={t('onboarding.yourName')}
              />
              <TouchableOpacity
                style={[styles.calcBtn, !nameInput.trim() && styles.calcBtnDisabled]}
                onPress={handleNameSubmit}
                disabled={!nameInput.trim()}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ disabled: !nameInput.trim() }}
                accessibilityLabel={t('onboarding.getStartedNameA11y')}
              >
                <Text style={styles.calcBtnText}>{t('onboarding.getStarted')}</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.bg.primary },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.base, paddingTop: 60 },
  back:            { fontSize: 22, color: colors.text.secondary, paddingRight: spacing.sm },
  dots:            { flexDirection: 'row', gap: 8 },
  dot:             { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border.default },
  dotActive:       { backgroundColor: colors.accent.primary, width: 20 },
  stepLabel:       { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary },
  content:         { padding: spacing.base, paddingTop: spacing.xl, gap: spacing.xl, paddingBottom: 60 },
  messageRow:      { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  avatar:          { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent.dim, borderWidth: 2, borderColor: colors.accent.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:      { fontSize: 18, color: colors.accent.primary },
  bubble:          { flex: 1, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, borderTopLeftRadius: radius.sm, padding: spacing.base },
  bubbleText:      { fontFamily: typography.fonts.body, fontSize: typography.sizes.base, color: colors.text.primary, lineHeight: 22 },
  options:         { gap: spacing.sm },
  chip:            { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.default, borderRadius: radius.full, paddingVertical: 14, paddingHorizontal: spacing.xl, alignItems: 'center' },
  chipText:        { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.primary },
  bmiForm:         { gap: spacing.base, backgroundColor: colors.bg.secondary, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border.subtle },
  inputGroup:      { gap: spacing.xs },
  inputLabel:      { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.secondary },
  input:           { backgroundColor: colors.bg.tertiary, borderWidth: 1, borderColor: colors.border.default, borderRadius: radius.lg, padding: 14, fontFamily: typography.fonts.body, fontSize: typography.sizes.lg, color: colors.text.primary },
  calcBtn:         { backgroundColor: colors.accent.primary, borderRadius: radius.full, paddingVertical: spacing.base, alignItems: 'center', marginTop: spacing.sm },
  calcBtnDisabled: { backgroundColor: colors.border.default },
  calcBtnText:     { fontFamily: typography.fonts.display, fontSize: typography.sizes.base, color: colors.text.inverse },
  bmiPreview:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bg.tertiary, borderRadius: radius.lg, padding: spacing.base },
  bmiPreviewLeft:  { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  bmiPreviewNum:   { fontFamily: typography.fonts.mono, fontSize: typography.sizes['2xl'] },
  bmiPreviewUnit:  { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, letterSpacing: 2 },
  bmiPreviewBadge: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 5 },
  bmiPreviewLabel: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.sm },
  bmiScaleRow:     { flexDirection: 'row', gap: spacing.xs },
  bmiScaleSeg:     { flex: 1, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center', gap: 3 },
  bmiScaleDot:     { width: 6, height: 6, borderRadius: 3 },
  bmiScaleLabel:   { fontFamily: typography.fonts.body, fontSize: 9, color: colors.text.tertiary, textAlign: 'center' },
  commentBox:      { backgroundColor: colors.accent.dim, borderRadius: radius.xl, padding: spacing.base, width: '100%', borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.19) },
  commentText:     { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.accent.primary, lineHeight: 20 },
  rangeError:      { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.status.danger, lineHeight: 20, marginTop: spacing.sm },
});

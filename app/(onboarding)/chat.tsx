import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { supabase } from '../../services/supabase';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';

/** Returns null when inputs are invalid (zero, negative, or missing). */
function calcBMI(weightKg: number, heightCm: number): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 100) / 100; // 2 decimal places
}

type BmiCat = { label: string; color: string; comment: string };

function bmiCategory(bmi: number | null): BmiCat | null {
  if (bmi === null) return null;
  if (bmi < 18.5) return { label: 'Underweight',     color: '#3B82F6', comment: 'Gaining a bit of weight will improve both your health and energy. Your plan has been adjusted accordingly.' };
  if (bmi < 25)   return { label: 'Normal',           color: '#10B981', comment: 'Great! You are at a healthy weight. Your plan focuses on maintaining and improving your current fitness.' };
  if (bmi < 30)   return { label: 'Overweight',       color: '#F59E0B', comment: 'No worries — this is very common. Your plan is designed for a slow and sustainable transformation.' };
  if (bmi < 35)   return { label: 'Obese (Class I)',  color: '#F97316', comment: 'You are taking the right step. With consistent movement and nutrition, big changes are possible.' };
  return           { label: 'Obese (Class II+)',       color: '#EF4444', comment: 'Investing in your health takes courage. Your plan will guide you step by step toward your goal.' };
}

const STEPS = [
  {
    type: 'chips' as const,
    message: "Hi! I'm Novra — your personal health coach.\nWhat do you most want to improve right now?",
    options: [
      { label: '🏃 Lose weight & get fit',       value: 'lose_weight' },
      { label: '💪 Build muscle & strength',     value: 'gain_muscle' },
      { label: '⚡ More energy & focus',          value: 'improve_energy' },
      { label: '😴 Better sleep & recovery',     value: 'better_sleep' },
      { label: '🧘 Reduce stress',               value: 'reduce_stress' },
      { label: '✨ Overall healthier lifestyle', value: 'general_health' },
    ],
    key: 'primary_goal',
  },
  {
    type: 'chips' as const,
    message: 'What is your biological sex? This helps me calculate your calorie and nutrition targets accurately.',
    options: [
      { label: '♂ Male',              value: 'male' },
      { label: '♀ Female',            value: 'female' },
      { label: '⚧ Prefer not to say', value: 'other' },
    ],
    key: 'gender',
  },
  {
    type: 'bmi' as const,
    message: 'Enter your height and weight — I will calculate your BMI and personalise your plan.',
    key: null,
  },
  {
    type: 'chips' as const,
    message: 'How many days per week do you exercise?',
    options: [
      { label: 'Never',           value: '0' },
      { label: '1-2 days',        value: '2' },
      { label: '3-4 days',        value: '3' },
      { label: '5 days',          value: '5' },
      { label: '6-7 days (Athlete)', value: '6' },
    ],
    key: 'workout_frequency',
  },
  {
    type: 'chips' as const,
    message: 'Where do you usually work out?',
    options: [
      { label: '🏋️ Gym — full equipment', value: 'gym' },
      { label: '🏠 Home — minimal gear',   value: 'home' },
    ],
    key: 'workout_environment',
  },
  {
    type: 'chips' as const,
    message: 'What is the biggest obstacle keeping you from a healthy lifestyle?',
    options: [
      { label: 'Not enough time',              value: 'no_time' },
      { label: 'Low motivation & energy',      value: 'low_motivation' },
      { label: 'Not sure where to start',      value: 'no_knowledge' },
      { label: 'Staying consistent with diet', value: 'food_discipline' },
    ],
    key: 'main_obstacle',
  },
  {
    type: 'text' as const,
    message: 'Almost done! What should I call you?',
    key: 'name',
  },
];

export default function OnboardingChat() {
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (!session) router.replace('/(auth)/login');
  }, [session]);

  const [step, setStep]           = useState(0);
  const [answers, setAnswers]     = useState<Record<string, string>>({});
  const [done, setDone]           = useState(false);
  const [bmiResult, setBmiResult] = useState<{ bmi: number; cat: BmiCat } | null>(null);

  const profile       = useUserStore((s) => s.profile);
  const updateProfile = useUserStore((s) => s.updateProfile);

  // Pre-fill from existing profile data for returning users
  const [height,    setHeight]    = useState(profile?.height_cm ? String(profile.height_cm) : '');
  const [weight,    setWeight]    = useState(profile?.weight_kg ? String(profile.weight_kg) : '');
  const [nameInput, setNameInput] = useState(profile?.name ?? '');

  const current = STEPS[step];

  const goNext = async (final: Record<string, string>) => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      setDone(true);
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

  const handleBmiCalc = () => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!h || !w) return;
    const bmi = calcBMI(w, h);
    const cat = bmiCategory(bmi);
    if (bmi === null || cat === null) return; // guard against invalid inputs
    setBmiResult({ bmi, cat });
    // Save numeric fields directly to profile so profile screen reflects them
    updateProfile({ height_cm: h, weight_kg: w, bmi });
  };

  const canCalc = parseFloat(height) >= 50 && parseFloat(weight) >= 20;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.header}>
          {step > 0 && !done && (
            <TouchableOpacity onPress={() => { setStep((s) => Math.max(0, s - 1)); setBmiResult(null); }}>
              <Text style={styles.back}>&#8592;</Text>
            </TouchableOpacity>
          )}
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
            ))}
          </View>
          <Text style={styles.stepLabel}>
            {done ? 'Complete' : `Step ${step + 1} / ${STEPS.length}`}
          </Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.messageRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>&#10022;</Text></View>
            <View style={styles.bubble}>
              <Text style={styles.bubbleText}>
                {done ? 'Your plan is being prepared...' : current.message}
              </Text>
            </View>
          </View>

          {!done && current.type === 'chips' && (
            <View style={styles.options}>
              {(current as { options: { label: string; value: string }[] }).options.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.chip}
                  onPress={() => handleChip(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!done && current.type === 'bmi' && !bmiResult && (
            <View style={styles.bmiForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Height (cm)</Text>
                <TextInput
                  style={styles.input}
                  value={height}
                  onChangeText={setHeight}
                  placeholder="e.g. 175"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="numeric"
                  maxLength={3}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Weight (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="e.g. 70"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
              <TouchableOpacity
                style={[styles.calcBtn, !canCalc && styles.calcBtnDisabled]}
                onPress={handleBmiCalc}
                disabled={!canCalc}
                activeOpacity={0.85}
              >
                <Text style={styles.calcBtnText}>Calculate BMI</Text>
              </TouchableOpacity>
            </View>
          )}

          {!done && current.type === 'text' && (
            <View style={styles.bmiForm}>
              <TextInput
                style={styles.input}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Your name"
                placeholderTextColor={colors.text.tertiary}
                maxLength={30}
                autoFocus
                onSubmitEditing={handleNameSubmit}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.calcBtn, !nameInput.trim() && styles.calcBtnDisabled]}
                onPress={handleNameSubmit}
                disabled={!nameInput.trim()}
                activeOpacity={0.85}
              >
                <Text style={styles.calcBtnText}>Get Started</Text>
              </TouchableOpacity>
            </View>
          )}

          {!done && current.type === 'bmi' && bmiResult && (
            <View style={styles.bmiResult}>
              <View style={[styles.bmiCircle, { borderColor: bmiResult.cat.color }]}>
                <Text style={[styles.bmiNum, { color: bmiResult.cat.color }]}>{bmiResult.bmi}</Text>
                <Text style={styles.bmiUnit}>BMI</Text>
              </View>

              <View style={[styles.catBadge, { backgroundColor: bmiResult.cat.color + '18', borderColor: bmiResult.cat.color + '40' }]}>
                <Text style={[styles.catLabel, { color: bmiResult.cat.color }]}>{bmiResult.cat.label}</Text>
              </View>

              <View style={styles.scale}>
                {[
                  { label: 'Underweight', range: '< 18.5',    color: '#3B82F6' },
                  { label: 'Normal',      range: '18.5-24.9', color: '#10B981' },
                  { label: 'Overweight',  range: '25-29.9',   color: '#F59E0B' },
                  { label: 'Obese',       range: '30+',       color: '#EF4444' },
                ].map((r) => (
                  <View key={r.label} style={styles.scaleRow}>
                    <View style={[styles.scaleDot, { backgroundColor: r.color }]} />
                    <Text style={styles.scaleLabel}>{r.label}</Text>
                    <Text style={styles.scaleRange}>{r.range}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.commentBox}>
                <Text style={styles.commentText}>{bmiResult.cat.comment}</Text>
              </View>

              <TouchableOpacity
                style={styles.continueBtn}
                onPress={() => { setBmiResult(null); goNext(answers); }}
                activeOpacity={0.85}
              >
                <Text style={styles.continueBtnText}>Continue</Text>
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
  calcBtn:         { backgroundColor: colors.accent.primary, borderRadius: radius.full, paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm },
  calcBtnDisabled: { backgroundColor: colors.border.default },
  calcBtnText:     { fontFamily: typography.fonts.display, fontSize: typography.sizes.base, color: colors.text.inverse },
  bmiResult:       { gap: spacing.base, alignItems: 'center' },
  bmiCircle:       { width: 130, height: 130, borderRadius: 65, borderWidth: 10, alignItems: 'center', justifyContent: 'center' },
  bmiNum:          { fontFamily: typography.fonts.display, fontSize: 36 },
  bmiUnit:         { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, letterSpacing: 3 },
  catBadge:        { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 18, paddingVertical: 6 },
  catLabel:        { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base },
  scale:           { backgroundColor: colors.bg.secondary, borderRadius: radius.xl, padding: spacing.base, width: '100%', gap: spacing.sm, borderWidth: 1, borderColor: colors.border.subtle },
  scaleRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scaleDot:        { width: 10, height: 10, borderRadius: 5 },
  scaleLabel:      { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.primary, flex: 1 },
  scaleRange:      { fontFamily: typography.fonts.mono, fontSize: typography.sizes.xs, color: colors.text.tertiary },
  commentBox:      { backgroundColor: colors.accent.dim, borderRadius: radius.xl, padding: spacing.base, width: '100%', borderWidth: 1, borderColor: colors.accent.primary + '30' },
  commentText:     { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.accent.primary, lineHeight: 20 },
  continueBtn:     { backgroundColor: colors.accent.primary, borderRadius: radius.full, paddingVertical: 14, alignItems: 'center', width: '100%' },
  continueBtnText: { fontFamily: typography.fonts.display, fontSize: typography.sizes.base, color: colors.text.inverse },
});

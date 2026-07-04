import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useUserStore } from '../../stores/userStore';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { useAISuggestionsStore, SuggestionType } from '../../stores/aiSuggestionsStore';
import { useAIChatStore, ChatMessage, WELCOME_MESSAGE } from '../../stores/aiChatStore';
import { useAuthStore } from '../../stores/authStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { getTodayMsgCount } from '../../stores/aiChatStore';
import { colors, withAlpha } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { supabase } from '../../services/supabase';
import { useT } from '../../constants/i18n';
import { Icon, Sparkles, X, ArrowUp } from '../../components/ui/Icon';

const EDGE_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-coach`;

type Role = 'user' | 'assistant';
type Message = ChatMessage;

/** Strip leading/trailing whitespace, collapse excessive newlines, hard-cap length. */
function sanitizeInput(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').trim().slice(0, 500);
}

/** Only non-PII goal/preference fields — never email, name, weight, height. */
const SAFE_PROFILE_KEYS = ['primary_goal', 'workout_frequency', 'activity_level', 'gender', 'workout_environment'] as const;

const NUTRITION_KW = ['meal', 'food', 'eat', 'diet', 'protein', 'calorie', 'nutrition', 'breakfast', 'lunch', 'dinner', 'snack', 'recipe', 'carb', 'fat', 'macro', 'vegetarian', 'keto', 'portion'];
const WORKOUT_KW   = ['workout', 'exercise', 'gym', 'train', 'muscle', 'strength', 'cardio', 'rep', 'set', 'pushup', 'squat', 'deadlift', 'bench', 'run', 'lifting', 'hiit'];

function detectType(userMsg: string, aiMsg: string): SuggestionType | null {
  const userLower = userMsg.toLowerCase();
  const combined  = (userMsg + ' ' + aiMsg).toLowerCase();
  // User message intent takes priority
  const userWantsWorkout   = WORKOUT_KW.some((k) => userLower.includes(k));
  const userWantsNutrition = NUTRITION_KW.some((k) => userLower.includes(k));
  if (userWantsWorkout && !userWantsNutrition) return 'workout';
  if (userWantsNutrition && !userWantsWorkout) return 'nutrition';
  // Fall back to keyword count in full response
  const workoutHits   = WORKOUT_KW.filter((k) => combined.includes(k)).length;
  const nutritionHits = NUTRITION_KW.filter((k) => combined.includes(k)).length;
  if (workoutHits > nutritionHits) return 'workout';
  if (nutritionHits > workoutHits) return 'nutrition';
  return null;
}

const QUICK_PROMPTS = [
  { labelKey: 'aiCoach.qpPlan',       prompt: 'Generate a weekly workout plan for me based on my goals.' },
  { labelKey: 'aiCoach.qpMeals',      prompt: 'Give me healthy meal ideas for today based on my diet preferences.' },
  { labelKey: 'aiCoach.qpSleep',      prompt: 'Give me 3 tips to improve my sleep and recovery tonight.' },
  { labelKey: 'aiCoach.qpMotivation', prompt: 'I need motivation to keep going. Give me a short pep talk.' },
];

export default function AICoachModal() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const userId          = useAuthStore((s) => s.user?.id ?? 'anonymous');
  const isPro           = useSubscriptionStore((s) => s.isPro);
  const chats           = useAIChatStore((s) => s.chats);
  const profile         = useUserStore((s) => s.profile);
  const recoveryEntries = useRecoveryStore((s) => s.entries);
  const saveSuggestion  = useAISuggestionsStore((s) => s.save);
  const rawMessages     = useAIChatStore((s) => s.chats[userId]);
  const messages        = rawMessages ?? [WELCOME_MESSAGE];
  const addMessage      = useAIChatStore((s) => s.addMessage);
  const clearHistory    = useAIChatStore((s) => s.clearHistory);
  const t = useT();

  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const listRef    = useRef<FlatList>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const FREE_LIMIT = 10;
  const todayCount = getTodayMsgCount(chats, userId);
  const limitReached = !isPro && todayCount >= FREE_LIMIT;

  const send = useCallback(async (text: string) => {
    const clean = sanitizeInput(text);
    if (!clean || loading) return;
    if (!isPro && getTodayMsgCount(chats, userId) >= FREE_LIMIT) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: clean };
    const history = [...messages, userMsg].slice(-10).map((m) => ({ role: m.role, content: m.text }));

    // Strip PII — only forward safe preference fields to the AI.
    const safeProfile = profile
      ? Object.fromEntries(
          SAFE_PROFILE_KEYS
            .filter((k) => profile[k] !== undefined)
            .map((k) => [k, profile[k]])
        )
      : null;

    addMessage(userId, userMsg);
    setInput('');
    setLoading(true);

    try {
      // Send the user's session JWT so the edge function can authenticate the
      // caller and apply per-user rate limiting (anon key has no user identity).
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(t('aiCoach.signInError'));

      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          messages: history,
          userProfile: safeProfile,
          mode: mode ?? 'chat',
          recoveryTrend: recoveryEntries.slice(-7),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Error ${res.status}`);
      }
      const data = await res.json();

      const replyText = data?.content ?? t('aiCoach.noResponse');
      const sType = detectType(text, replyText);
      if (sType) saveSuggestion(sType, replyText);

      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: replyText,
        suggestionType: sType,
      };
      addMessage(userId, reply);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
      setTimeout(() => {
        if (mountedRef.current) listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, loading, profile, recoveryEntries, mode, saveSuggestion, userId, t]);

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const navTarget = item.suggestionType === 'nutrition'
      ? { label: t('aiCoach.viewInNutrition'), route: '/(tabs)/nutrition' }
      : item.suggestionType === 'workout'
      ? { label: t('aiCoach.viewInWorkout'),   route: '/(tabs)/workout' }
      : null;

    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Icon icon={Sparkles} size="sm" color={colors.accent.primary} />
          </View>
        )}
        <View style={{ maxWidth: '78%' }}>
          <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
            <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.text}</Text>
          </View>
          {navTarget && (
            <TouchableOpacity
              style={styles.viewTabBtn}
              onPress={() => {
                router.back();
                setTimeout(() => router.push(navTarget.route as any), 300);
              }}
              activeOpacity={0.8}
              accessibilityRole="link"
              accessibilityLabel={navTarget.label.replace(/[^\w\s]/g, '').trim()}
            >
              <Text style={styles.viewTabText}>{navTarget.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [t]);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.aiBadge}><Icon icon={Sparkles} size="md" color={colors.accent.primary} /></View>
          <View>
            <Text style={styles.title}>{t('aiCoach.title')}</Text>
            <Text style={styles.sub}>{t('aiCoach.poweredBy')}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel={t('aiCoach.closeA11y')}>
          <Icon icon={X} size="md" color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Loading indicator */}
      {loading && (
        <View style={styles.typingRow}>
          <View style={styles.avatar}><Icon icon={Sparkles} size="sm" color={colors.accent.primary} /></View>
          <View style={styles.typingBubble}>
            <ActivityIndicator size="small" color={colors.accent.primary} />
          </View>
        </View>
      )}

      {/* Clear history — only shown when chat has content, away from close button */}
      {messages.length > 1 && !loading && (
        <TouchableOpacity
          style={styles.clearRow}
          onPress={() => Alert.alert(t('aiCoach.clearChat'), t('aiCoach.clearChatConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('aiCoach.clear'), style: 'destructive', onPress: () => clearHistory(userId) },
          ])}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('aiCoach.clearConversationA11y')}
        >
          <Text style={styles.clearRowText}>{t('aiCoach.clearConversation')}</Text>
        </TouchableOpacity>
      )}

      {/* Quick prompts */}
      {messages.length <= 1 && !loading && (
        <View style={styles.quickRow}>
          {QUICK_PROMPTS.map((q) => (
            <TouchableOpacity key={q.labelKey} style={styles.quickChip} onPress={() => send(q.prompt)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={t(q.labelKey).replace(/[^\w\s]/g, '').trim()}>
              <Text style={styles.quickText}>{t(q.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Daily limit banner for free users */}
      {limitReached && (
        <View style={styles.limitBanner}>
          <Text style={styles.limitText}>{t('aiCoach.limitReached')}</Text>
          <TouchableOpacity onPress={() => router.push('/paywall')} style={styles.limitBtn} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('aiCoach.upgradeA11y')}>
            <Text style={styles.limitBtnText}>{t('aiCoach.upgrade')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputRow, limitReached && { opacity: 0.4 }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={t('aiCoach.placeholder')}
          placeholderTextColor={colors.text.tertiary}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => send(input)}
          accessibilityLabel={t('aiCoach.inputA11y')}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => send(input)}
          disabled={!input.trim() || loading}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('aiCoach.sendA11y')}
          accessibilityState={{ disabled: !input.trim() || loading }}
        >
          <Icon icon={ArrowUp} size="md" color={colors.text.inverse} strokeWidth={2.25} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.tertiary },

  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.base, paddingTop: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border.subtle, backgroundColor: colors.bg.secondary },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aiBadge:    { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent.dim, alignItems: 'center', justifyContent: 'center' },
  title:      { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  sub:        { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },
  clearBtn:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary },

  list: { padding: spacing.base, gap: spacing.sm, paddingBottom: spacing.lg },

  msgRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.sm },
  msgRowUser: { flexDirection: 'row-reverse' },
  avatar:     { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent.dim, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  bubble:         { maxWidth: '78%', borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleAI:       { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle },
  bubbleUser:     { backgroundColor: colors.accent.primary },
  bubbleText:     { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.primary, lineHeight: 20 },
  bubbleTextUser: { color: colors.text.inverse },

  typingRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.base, paddingBottom: spacing.sm },
  typingBubble: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, paddingHorizontal: 16, paddingVertical: 10 },

  quickRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.base, paddingBottom: spacing.sm },
  quickChip: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.25), borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  quickText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },

  inputRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.base, paddingBottom: Platform.OS === 'ios' ? 32 : spacing.base, backgroundColor: colors.bg.secondary, borderTopWidth: 1, borderTopColor: colors.border.subtle },
  input:          { flex: 1, fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.primary, backgroundColor: colors.bg.tertiary, borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100 },
  sendBtn:        { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:{ backgroundColor: colors.border.default },

  viewTabBtn:  { marginTop: 6, backgroundColor: colors.accent.dim, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.3), borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start' },
  viewTabText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },

  clearRow:     { alignItems: 'center', paddingVertical: 6, paddingHorizontal: spacing.base },
  clearRowText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },

  limitBanner: { backgroundColor: colors.bg.secondary, borderTopWidth: 1, borderTopColor: withAlpha(colors.accent.primary, 0.25), paddingVertical: spacing.base, paddingHorizontal: spacing.base, alignItems: 'center', gap: spacing.sm },
  limitText:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, textAlign: 'center' },
  limitBtn:    { backgroundColor: colors.accent.primary, borderRadius: radius.full, paddingHorizontal: 24, paddingVertical: 9 },
  limitBtnText:{ fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.inverse },
});

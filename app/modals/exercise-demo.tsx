import { useState, useEffect } from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { fetchExerciseDemo, ExerciseDemo } from '../../services/exercisedb';
import { colors, withAlpha } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { useT } from '../../constants/i18n';
import { Icon, Dumbbell, X, Target, MapPin, Wrench } from '../../components/ui/Icon';

export default function ExerciseDemoModal() {
  const { name, muscle } = useLocalSearchParams<{ name: string; muscle?: string }>();
  const t = useT();

  const [demo,    setDemo]    = useState<ExerciseDemo | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgErr,  setImgErr]  = useState(false);

  useEffect(() => {
    if (!name) { setLoading(false); return; }
    fetchExerciseDemo(name).then((result) => {
      setDemo(result);
      setLoading(false);
    });
  }, [name]);

  const openYouTube = () => {
    const query = encodeURIComponent(`how to do ${name} exercise proper form`);
    Linking.openURL(`https://www.youtube.com/results?search_query=${query}`);
  };

  return (
    <View style={styles.screen}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.badge}><Icon icon={Dumbbell} size="md" color={colors.accent.primary} /></View>
          <View>
            <Text style={styles.title} numberOfLines={1}>{name}</Text>
            {muscle ? <Text style={styles.sub}>{muscle}</Text> : null}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('exerciseDemo.close')}
        >
          <Icon icon={X} size="md" color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── GIF Demo ── */}
        <View style={styles.gifCard}>
          {loading ? (
            <View style={styles.gifPlaceholder}>
              <ActivityIndicator size="large" color={colors.accent.primary} />
              <Text style={styles.loadingText}>{t('exerciseDemo.loading')}</Text>
            </View>
          ) : demo?.gifUrl && !imgErr ? (
            <Image
              source={{ uri: demo.gifUrl }}
              style={styles.gif}
              resizeMode="contain"
              onError={() => setImgErr(true)}
            />
          ) : (
            <View style={styles.gifPlaceholder}>
              <Icon icon={Dumbbell} size={48} color={colors.text.tertiary} strokeWidth={1.5} />
              <Text style={styles.noGifText}>{t('exerciseDemo.noDemo')}</Text>
              <Text style={styles.noGifSub}>{t('exerciseDemo.watchYoutubeInstead')}</Text>
            </View>
          )}
        </View>

        {/* ── Metadata chips ── */}
        {demo && (
          <View style={styles.metaRow}>
            {demo.bodyPart ? (
              <View style={styles.metaChip}>
                <Icon icon={MapPin} size={12} color={colors.text.secondary} />
                <Text style={styles.metaChipText}>{demo.bodyPart}</Text>
              </View>
            ) : null}
            {demo.target ? (
              <View style={styles.metaChip}>
                <Icon icon={Target} size={12} color={colors.text.secondary} />
                <Text style={styles.metaChipText}>{demo.target}</Text>
              </View>
            ) : null}
            {demo.equipment ? (
              <View style={styles.metaChip}>
                <Icon icon={Wrench} size={12} color={colors.text.secondary} />
                <Text style={styles.metaChipText}>{demo.equipment}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── Step-by-step instructions ── */}
        {demo?.instructions && demo.instructions.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('exerciseDemo.howToDoIt')}</Text>
            <View style={styles.stepList}>
              {demo.instructions.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : !loading ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('exerciseDemo.howToDoIt')}</Text>
            <Text style={styles.noInstructions}>
              {t('exerciseDemo.noInstructions')}
            </Text>
          </View>
        ) : null}

        {/* ── YouTube button ── */}
        <TouchableOpacity style={styles.youtubeBtn} onPress={openYouTube} activeOpacity={0.85} accessibilityRole="link" accessibilityLabel={t('exerciseDemo.watchTutorialA11y', { name: name ?? '' })}>
          <Text style={styles.youtubeBtnText}>{t('exerciseDemo.watchYoutube')}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg.primary },

  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.base, paddingTop: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border.subtle, backgroundColor: colors.bg.secondary },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, marginRight: spacing.sm },
  badge:      { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent.dim, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:      { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  sub:        { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
  closeBtn:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.base, color: colors.text.secondary },

  content: { padding: spacing.base, gap: spacing.base },

  gifCard:       { backgroundColor: colors.bg.secondary, borderRadius: radius['2xl'], borderWidth: 1, borderColor: colors.border.subtle, overflow: 'hidden', height: 280, alignItems: 'center', justifyContent: 'center' },
  gif:           { width: '100%', height: 280 },
  gifPlaceholder:{ alignItems: 'center', gap: spacing.sm },
  loadingText:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary },
  noGifText:     { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.secondary },
  noGifSub:      { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },

  metaRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metaChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  metaChipText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.text.secondary },

  section:         { gap: spacing.sm },
  sectionTitle:    { fontFamily: typography.fonts.heading, fontSize: typography.sizes.md, color: colors.text.primary },
  stepList:        { gap: spacing.sm },
  stepRow:         { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepNum:         { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent.dim, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.3), alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  stepNumText:     { fontFamily: typography.fonts.display, fontSize: typography.sizes.xs, color: colors.accent.primary },
  stepText:        { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, lineHeight: 20, flex: 1 },
  noInstructions:  { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary, lineHeight: 20 },

  youtubeBtn:     { backgroundColor: '#FF0000', borderRadius: radius.full, paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm },
  youtubeBtnText: { fontFamily: typography.fonts.display, fontSize: typography.sizes.base, color: '#FFFFFF' },
});

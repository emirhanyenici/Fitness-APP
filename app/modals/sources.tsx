import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MEDICAL_DISCLAIMER, CITATIONS } from '../../constants/legal';
import { type Colors } from '../../constants/colors';
import { useColors } from '../../constants/useColors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { useT } from '../../constants/i18n';
import { Icon, ArrowLeft, Stethoscope, BookOpen, ExternalLink } from '../../components/ui/Icon';

export default function SourcesModal() {
  const insets = useSafeAreaInsets();
  const t      = useT();
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('sources.goBack')}>
          <Icon icon={ArrowLeft} size="lg" color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('sources.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimerCard}>
        <View style={styles.disclaimerHeader}>
          <Icon icon={Stethoscope} size="md" color={colors.accent.primary} />
          <Text style={styles.disclaimerTitle}>{t('sources.disclaimerTitle')}</Text>
        </View>
        <Text style={styles.disclaimerText}>{MEDICAL_DISCLAIMER}</Text>
      </View>

      {/* References */}
      <View style={styles.refHeader}>
        <Icon icon={BookOpen} size="md" color={colors.accent.primary} />
        <Text style={styles.refTitle}>{t('sources.referencesTitle')}</Text>
      </View>
      <Text style={styles.refSub}>{t('sources.referencesSub')}</Text>

      <View style={styles.card}>
        {CITATIONS.map((c, i) => (
          <TouchableOpacity
            key={c.url}
            style={[styles.row, i === CITATIONS.length - 1 && { borderBottomWidth: 0 }]}
            onPress={() => Linking.openURL(c.url)}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel={`${c.metric}: ${c.title}, ${c.source}`}
          >
            <View style={styles.rowMid}>
              <Text style={styles.metric}>{c.metric}</Text>
              <Text style={styles.citationTitle}>{c.title}</Text>
              <Text style={styles.citationSource}>{c.source}</Text>
              <View style={styles.viewSourceRow}>
                <Text style={styles.viewSourceText}>{t('sources.viewSource')}</Text>
                <Icon icon={ExternalLink} size={12} color={colors.accent.primary} />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const getStyles = (colors: Colors) => StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.base },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  title:  { fontFamily: typography.fonts.display, fontSize: typography.sizes.xl, color: colors.text.primary },

  disclaimerCard: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.base, marginBottom: spacing.xl },
  disclaimerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  disclaimerTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  disclaimerText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, lineHeight: 20 },

  refHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  refTitle:  { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  refSub:    { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, lineHeight: 20, marginBottom: spacing.base },

  card: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, overflow: 'hidden' },
  row:  { paddingVertical: 14, paddingHorizontal: spacing.base, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  rowMid: { flex: 1 },
  metric: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  citationTitle: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.primary, lineHeight: 19 },
  citationSource: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
  viewSourceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  viewSourceText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },
});

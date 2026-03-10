import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius } from '../constants/spacing';

const FEATURES = [
  { icon: '🧠', title: 'One coach for everything', sub: 'Sleep, food, exercise, mood — all connected' },
  { icon: '📸', title: 'Snap your food', sub: 'Photo → instant calories and macros. No typing.' },
  { icon: '📊', title: 'Weekly AI report', sub: 'See patterns, spot what\'s working, fix what\'s not.' },
  { icon: '⚡', title: 'Full Novra Score breakdown', sub: 'Per-pillar insights + trend charts' },
];

export default function PaywallScreen() {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.crown}>👑</Text>
        <Text style={styles.title}>Meet your real Novra</Text>
        <Text style={styles.sub}>Everything you need. Nothing you don't.</Text>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureSub}>{f.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.priceCard}>
          <View style={styles.saveBadge}><Text style={styles.saveBadgeText}>SAVE 48%</Text></View>
          <Text style={styles.price}>$49.99<Text style={styles.pricePer}> / year</Text></Text>
          <Text style={styles.priceSub}>Just $4.16/month · Best value</Text>
        </View>

        <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.85}>
          <Text style={styles.ctaBtnText}>Start 3-Day Free Trial →</Text>
          <Text style={styles.ctaSub}>Then $49.99/yr. Cancel anytime.</Text>
        </TouchableOpacity>

        <Text style={styles.monthly} onPress={() => {}}>Or $7.99/month →</Text>

        <Text style={styles.footer}>Restore Purchase · Privacy Policy · Terms</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  closeBtn: { position: 'absolute', top: 56, right: spacing.base, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg.elevated, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: colors.text.secondary, fontSize: 16 },
  content: { padding: spacing.base, paddingTop: 80, alignItems: 'center' },
  crown: { fontSize: 44, marginBottom: spacing.sm },
  title: { fontFamily: typography.fonts.display, fontSize: typography.sizes['2xl'], color: colors.text.primary, textAlign: 'center' },
  sub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.base, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl },
  features: { width: '100%', gap: spacing.sm, marginBottom: spacing.xl },
  featureRow: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.base, flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  featureIcon: { fontSize: 26 },
  featureTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  featureSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: 2 },
  priceCard: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.accent.primary + '40', borderRadius: radius.xl, padding: spacing.xl, width: '100%', alignItems: 'center', marginBottom: spacing.base },
  saveBadge: { backgroundColor: colors.status.success, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 4, marginBottom: spacing.sm },
  saveBadgeText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.text.inverse },
  price: { fontFamily: typography.fonts.display, fontSize: typography.sizes['3xl'], color: colors.text.primary },
  pricePer: { fontFamily: typography.fonts.body, fontSize: typography.sizes.lg, color: colors.text.secondary },
  priceSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: spacing.xs },
  ctaBtn: { backgroundColor: colors.accent.primary, borderRadius: radius.full, paddingVertical: 18, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: spacing.sm },
  ctaBtnText: { fontFamily: typography.fonts.display, fontSize: typography.sizes.md, color: colors.text.inverse },
  ctaSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.inverse, opacity: 0.7, marginTop: 4 },
  monthly: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.accent.primary, marginVertical: spacing.base },
  footer: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.sm },
});

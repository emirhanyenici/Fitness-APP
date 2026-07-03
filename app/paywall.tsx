import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Purchases from 'react-native-purchases';
import { isPurchasesConfigured, planFromCustomerInfo } from '../services/purchases';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius } from '../constants/spacing';
import { useT } from '../constants/i18n';

export default function PaywallScreen() {
  const [loading, setLoading] = useState(false);
  const setPlan = useSubscriptionStore((s) => s.setPlan);
  const t = useT();

  const FEATURES = [
    { icon: '🧠', title: t('paywall.featAiTitle'),     sub: t('paywall.featAiSub') },
    { icon: '📸', title: t('paywall.featSnapTitle'),   sub: t('paywall.featSnapSub') },
    { icon: '📊', title: t('paywall.featReportTitle'), sub: t('paywall.featReportSub') },
    { icon: '📈', title: t('paywall.featTrendTitle'),  sub: t('paywall.featTrendSub') },
  ];

  const handlePurchase = async (productId: string) => {
    if (!isPurchasesConfigured()) {
      Alert.alert(t('paywall.unavailable'), t('paywall.noOfferings'));
      return;
    }
    setLoading(true);
    try {
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      if (!current) {
        Alert.alert(t('paywall.unavailable'), t('paywall.noOfferings'));
        return;
      }

      // Find the matching package by product identifier
      const pkg = current.availablePackages.find(
        (p) => p.product.identifier === productId
      ) ?? current.availablePackages[0];

      if (!pkg) {
        Alert.alert(t('paywall.unavailable'), t('paywall.noPackage'));
        return;
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const plan = planFromCustomerInfo(customerInfo);
      if (plan !== 'free') {
        setPlan(plan);
        Alert.alert(t('paywall.welcomeProTitle'), t('paywall.welcomeProBody'));
        router.back();
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert(t('paywall.purchaseFailed'), e.message ?? t('paywall.somethingWrong'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!isPurchasesConfigured()) {
      Alert.alert(t('paywall.unavailable'), t('paywall.noOfferings'));
      return;
    }
    setLoading(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const plan = planFromCustomerInfo(customerInfo);
      if (plan !== 'free') {
        setPlan(plan);
        Alert.alert(t('paywall.restoredTitle'), t('paywall.restoredBody'));
        router.back();
      } else {
        Alert.alert(t('paywall.nothingRestore'), t('paywall.noActiveSub'));
      }
    } catch (e: any) {
      Alert.alert(t('paywall.restoreFailed'), e.message ?? t('paywall.tryAgain'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('paywall.close')}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.crown}>👑</Text>
        <Text style={styles.title}>{t('paywall.title')}</Text>
        <Text style={styles.sub}>{t('paywall.subtitle')}</Text>

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
          <View style={styles.priceTopRow}>
            <View style={styles.saveBadge}><Text style={styles.saveBadgeText}>{t('paywall.save48')}</Text></View>
            <Text style={styles.priceRef}>{t('paywall.vsMonthly')}</Text>
          </View>
          <Text style={styles.price}>$49.99<Text style={styles.pricePer}>{t('paywall.perYear')}</Text></Text>
          <Text style={styles.priceSub}>{t('paywall.bestValue')}</Text>
        </View>

        <TouchableOpacity
          style={[styles.ctaBtn, loading && { opacity: 0.6 }]}
          activeOpacity={0.85}
          disabled={loading}
          onPress={() => handlePurchase('novra_pro_yearly')}
          accessibilityRole="button"
          accessibilityState={{ disabled: loading, busy: loading }}
          accessibilityLabel={t('paywall.trialA11y')}
        >
          {loading
            ? <ActivityIndicator color={colors.text.inverse} />
            : <>
                <Text style={styles.ctaBtnText}>{t('paywall.startTrial')}</Text>
                <Text style={styles.ctaSub}>{t('paywall.thenPrice')}</Text>
              </>
          }
        </TouchableOpacity>

        <Text
          style={styles.monthly}
          onPress={() => !loading && handlePurchase('novra_pro_monthly')}
          accessibilityRole="button"
          accessibilityLabel={t('paywall.monthlyA11y')}
        >
          {t('paywall.orMonthly')}
        </Text>

        <Text
          style={styles.footer}
          onPress={handleRestore}
          accessibilityRole="button"
          accessibilityLabel={t('paywall.restoreA11y')}
        >
          {t('paywall.restoreFooter')}
        </Text>
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
  priceTopRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: spacing.sm },
  saveBadge:     { backgroundColor: colors.status.success, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  saveBadgeText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.text.inverse },
  priceRef:      { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, textDecorationLine: 'line-through' },
  price: { fontFamily: typography.fonts.display, fontSize: typography.sizes['3xl'], color: colors.text.primary },
  pricePer: { fontFamily: typography.fonts.body, fontSize: typography.sizes.lg, color: colors.text.secondary },
  priceSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: spacing.xs },
  ctaBtn: { backgroundColor: colors.accent.primary, borderRadius: radius.full, paddingVertical: 18, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: spacing.sm },
  ctaBtnText: { fontFamily: typography.fonts.display, fontSize: typography.sizes.md, color: colors.text.inverse },
  ctaSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.inverse, opacity: 0.7, marginTop: 4 },
  monthly: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.accent.primary, marginVertical: spacing.base },
  footer: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.sm },
});

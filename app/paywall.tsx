import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import Purchases from 'react-native-purchases';
import { isPurchasesConfigured, planFromCustomerInfo } from '../services/purchases';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { colors, withAlpha } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing, radius } from '../constants/spacing';
import { elevation } from '../constants/elevation';
import { useT } from '../constants/i18n';
import { Button } from '../components/ui/Button';
import { Icon, X, Crown, Brain, Camera, ChartColumn, TrendingUp, NotebookPen } from '../components/ui/Icon';

export default function PaywallScreen() {
  const [loading, setLoading] = useState(false);
  const setPlan = useSubscriptionStore((s) => s.setPlan);
  const t = useT();

  const FEATURES = [
    { icon: Brain,       title: t('paywall.featAiTitle'),          sub: t('paywall.featAiSub') },
    { icon: Camera,      title: t('paywall.featSnapTitle'),        sub: t('paywall.featSnapSub') },
    { icon: ChartColumn, title: t('paywall.featReportTitle'),      sub: t('paywall.featReportSub') },
    { icon: TrendingUp,  title: t('paywall.featTrendTitle'),       sub: t('paywall.featTrendSub') },
    { icon: NotebookPen, title: t('paywall.featProgramsTitle'),    sub: t('paywall.featProgramsSub') },
    { icon: Crown,       title: t('paywall.featProgressionTitle'), sub: t('paywall.featProgressionSub') },
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
        <Icon icon={X} size="md" color={colors.text.secondary} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.crown}>
          <Icon icon={Crown} size={44} color={colors.accent.primary} strokeWidth={1.5} />
        </View>
        <Text style={styles.title}>{t('paywall.title')}</Text>
        <Text style={styles.sub}>{t('paywall.subtitle')}</Text>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <Icon icon={f.icon} size="lg" color={colors.accent.primary} />
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

        <Button
          label={t('paywall.startTrial')}
          subLabel={t('paywall.thenPrice')}
          onPress={() => handlePurchase('zenova_pro_yearly')}
          loading={loading}
          accessibilityLabel={t('paywall.trialA11y')}
          style={{ width: '100%', marginBottom: spacing.sm }}
        />

        <Text
          style={styles.monthly}
          onPress={() => !loading && handlePurchase('zenova_pro_monthly')}
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

        {/* App Store 3.1.2: subscription screens must state auto-renew terms and
            link to the privacy policy + terms of use. */}
        <Text style={styles.autoRenewNote}>{t('paywall.autoRenewNote')}</Text>
        <View style={styles.legalRow}>
          <Text
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://zenovaapp.com/terms')}
            accessibilityRole="link"
          >
            {t('profile.termsOfService')}
          </Text>
          <Text style={styles.legalDot}>·</Text>
          <Text
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://zenovaapp.com/privacy')}
            accessibilityRole="link"
          >
            {t('profile.privacyPolicy')}
          </Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  closeBtn: { position: 'absolute', top: 56, right: spacing.base, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg.elevated, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.base, paddingTop: 80, alignItems: 'center' },
  crown: { marginBottom: spacing.sm, alignItems: 'center' },
  title: { fontFamily: typography.fonts.display, fontSize: typography.sizes['2xl'], color: colors.text.primary, textAlign: 'center' },
  sub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.base, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl },
  features: { width: '100%', gap: spacing.sm, marginBottom: spacing.xl },
  featureRow: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.base, flexDirection: 'row', alignItems: 'center', gap: spacing.base, ...elevation.card },
  featureTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
  featureSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: 2 },
  priceCard: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.25), borderRadius: radius.xl, padding: spacing.xl, width: '100%', alignItems: 'center', marginBottom: spacing.base, ...elevation.raised },
  priceTopRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: spacing.sm },
  saveBadge:     { backgroundColor: colors.status.success, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  saveBadgeText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.text.inverse },
  priceRef:      { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, textDecorationLine: 'line-through' },
  price: { fontFamily: typography.fonts.mono, fontSize: typography.sizes['3xl'], color: colors.text.primary },
  pricePer: { fontFamily: typography.fonts.body, fontSize: typography.sizes.lg, color: colors.text.secondary },
  priceSub: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: spacing.xs },
  monthly: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.accent.primary, marginVertical: spacing.base },
  footer: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.sm },
  autoRenewNote: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.base, paddingHorizontal: spacing.sm },
  legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xs },
  legalLink: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.text.secondary, textDecorationLine: 'underline' },
  legalDot: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },
});

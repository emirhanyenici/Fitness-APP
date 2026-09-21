import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { isPurchasesConfigured, planFromCustomerInfo, formatSubscriptionPeriod } from '../services/purchases';
import { logError } from '../services/monitoring';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { withAlpha, type Colors } from '../constants/colors';
import { useColors } from '../constants/useColors';
import { typography } from '../constants/typography';
import { spacing, radius } from '../constants/spacing';
import { getElevation } from '../constants/elevation';
import { useT } from '../constants/i18n';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { Icon, X, Crown, Brain, Camera, ChartColumn, TrendingUp, NotebookPen, Check } from '../components/ui/Icon';

type ProductId = 'zenova_pro_yearly' | 'zenova_pro_monthly';

/** One selectable subscription option, fully described per App Store 3.1.2. */
interface PlanOption {
  id: ProductId;
  pkg: PurchasesPackage;
  title: string;
  length: string;
  per: string;
  price: string;
  /** Yearly only: "≈ $x.xx / month" equivalent. */
  perMonth: string | null;
  /** Yearly only: "SAVE n%" vs. 12 × monthly. */
  saveBadge: string | null;
}

export default function PaywallScreen() {
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [loading, setLoading] = useState(false);
  const [yearlyPkg, setYearlyPkg] = useState<PurchasesPackage | null>(null);
  const [monthlyPkg, setMonthlyPkg] = useState<PurchasesPackage | null>(null);
  // 'loading' until getOfferings resolves; 'error' if it fails or the SDK
  // isn't configured — the paywall then shows no price at all rather than
  // a placeholder that could disagree with the store (App Store 3.1.2).
  const [offeringsState, setOfferingsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedId, setSelectedId] = useState<ProductId>('zenova_pro_yearly');
  const setPlan = useSubscriptionStore((s) => s.setPlan);
  const t = useT();

  useEffect(() => {
    if (!isPurchasesConfigured()) { setOfferingsState('error'); return; }
    let cancelled = false;
    Purchases.getOfferings()
      .then((offerings) => {
        if (cancelled) return;
        const current = offerings.current;
        const yearly = current?.availablePackages.find((p) => p.product.identifier === 'zenova_pro_yearly') ?? null;
        const monthly = current?.availablePackages.find((p) => p.product.identifier === 'zenova_pro_monthly') ?? null;
        setYearlyPkg(yearly);
        setMonthlyPkg(monthly);
        setOfferingsState(yearly || monthly ? 'ready' : 'error');
      })
      .catch((e) => {
        logError(e, { scope: 'paywall', op: 'getOfferings' });
        if (!cancelled) setOfferingsState('error');
      });
    return () => { cancelled = true; };
  }, []);

  // App Store 3.1.2: each option states title + length + price, all from
  // the live store product (localized price, real billing period).
  const plans = useMemo<PlanOption[]>(() => {
    const build = (id: ProductId, pkg: PurchasesPackage | null, fallbackPer: 'year' | 'month'): PlanOption | null => {
      if (!pkg) return null;
      const period = formatSubscriptionPeriod(pkg.product.subscriptionPeriod)
        ?? { length: `1 ${fallbackPer}`, per: fallbackPer };
      return {
        id,
        pkg,
        title: t(id === 'zenova_pro_yearly' ? 'paywall.planYearlyTitle' : 'paywall.planMonthlyTitle'),
        length: period.length,
        per: period.per,
        price: pkg.product.priceString,
        perMonth: null,
        saveBadge: null,
      };
    };
    const yearly = build('zenova_pro_yearly', yearlyPkg, 'year');
    const monthly = build('zenova_pro_monthly', monthlyPkg, 'month');
    if (yearly && yearlyPkg) {
      const perMonthStr = yearlyPkg.product.pricePerMonthString;
      if (perMonthStr) yearly.perMonth = t('paywall.yearlyPerMonth', { price: perMonthStr });
      if (monthlyPkg) {
        const pct = Math.round((1 - yearlyPkg.product.price / (monthlyPkg.product.price * 12)) * 100);
        if (Number.isFinite(pct) && pct > 0) yearly.saveBadge = t('paywall.saveBadge', { pct });
      }
    }
    return [yearly, monthly].filter((p): p is PlanOption => p != null);
  }, [yearlyPkg, monthlyPkg, t]);

  const selected = plans.find((p) => p.id === selectedId) ?? plans[0] ?? null;

  const FEATURES = [
    { icon: Brain,       title: t('paywall.featAiTitle'),          sub: t('paywall.featAiSub') },
    { icon: Camera,      title: t('paywall.featSnapTitle'),        sub: t('paywall.featSnapSub') },
    { icon: ChartColumn, title: t('paywall.featReportTitle'),      sub: t('paywall.featReportSub') },
    { icon: TrendingUp,  title: t('paywall.featTrendTitle'),       sub: t('paywall.featTrendSub') },
    { icon: NotebookPen, title: t('paywall.featProgramsTitle'),    sub: t('paywall.featProgramsSub') },
    { icon: Crown,       title: t('paywall.featProgressionTitle'), sub: t('paywall.featProgressionSub') },
  ];

  const handlePurchase = async () => {
    if (!isPurchasesConfigured() || !selected) {
      Alert.alert(t('paywall.unavailable'), t('paywall.noOfferings'));
      return;
    }
    setLoading(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(selected.pkg);
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

        <Text style={styles.sectionLabel}>{t('paywall.choosePlan')}</Text>

        {offeringsState === 'loading' && (
          <View style={styles.plans} accessibilityLabel={t('paywall.loadingPrices')}>
            <Skeleton height={92} borderRadius={radius.xl} />
            <Skeleton height={92} borderRadius={radius.xl} />
          </View>
        )}
        {offeringsState === 'error' && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{t('paywall.pricesUnavailable')}</Text>
          </View>
        )}
        {offeringsState === 'ready' && (
          <View style={styles.plans}>
            {plans.map((p) => {
              const isSelected = selected?.id === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => !loading && setSelectedId(p.id)}
                  style={[styles.planCard, isSelected && styles.planCardSelected]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected, checked: isSelected, disabled: loading }}
                  accessibilityLabel={t('paywall.planA11y', { title: p.title, length: p.length, price: p.price, per: p.per })}
                >
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <Icon icon={Check} size="sm" color={colors.text.inverse} strokeWidth={3} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.planTitleRow}>
                      <Text style={styles.planTitle}>{p.title}</Text>
                      {p.saveBadge && (
                        <View style={styles.saveBadge}><Text style={styles.saveBadgeText}>{p.saveBadge}</Text></View>
                      )}
                    </View>
                    <Text style={styles.planLength}>{t('paywall.planLength', { length: p.length })}</Text>
                    {p.perMonth && <Text style={styles.planPerMonth}>{p.perMonth} · {t('paywall.bestValue')}</Text>}
                  </View>
                  <View style={styles.planPriceCol}>
                    <Text style={styles.planPrice}>{p.price}</Text>
                    <Text style={styles.planPer}>/ {p.per}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Button
          label={selected ? t('paywall.cta', { price: selected.price, per: selected.per }) : t('paywall.ctaLoading')}
          subLabel={selected ? t('paywall.autoRenewsAt', { price: selected.price, per: selected.per }) : undefined}
          onPress={handlePurchase}
          loading={loading}
          disabled={!selected}
          accessibilityLabel={selected
            ? t('paywall.ctaA11y', { title: selected.title, price: selected.price, per: selected.per })
            : t('paywall.ctaLoading')}
          style={{ width: '100%', marginBottom: spacing.sm }}
        />

        <Pressable
          onPress={() => !loading && handleRestore()}
          accessibilityRole="button"
          accessibilityLabel={t('paywall.restoreA11y')}
          accessibilityState={{ disabled: loading }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.footer, loading && styles.linkDisabled]}>
            {t('paywall.restoreFooter')}
          </Text>
        </Pressable>

        {/* App Store 3.1.2: subscription screens must state auto-renew terms and
            link to the Terms of Use (EULA) + privacy policy. */}
        <Text style={styles.autoRenewNote}>{t('paywall.autoRenewNote')}</Text>
        <View style={styles.legalRow}>
          <Pressable
            onPress={() => Linking.openURL('https://zenovaapp.com/terms')}
            accessibilityRole="link"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.legalLink}>{t('paywall.termsOfUse')}</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable
            onPress={() => Linking.openURL('https://zenovaapp.com/privacy')}
            accessibilityRole="link"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.legalLink}>{t('profile.privacyPolicy')}</Text>
          </Pressable>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: Colors) => {
  const elevation = getElevation(colors);
  return StyleSheet.create({
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
    sectionLabel: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.sm, color: colors.text.secondary, alignSelf: 'flex-start', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
    plans: { width: '100%', gap: spacing.sm, marginBottom: spacing.base },
    planCard: { backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.base, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...elevation.card },
    planCardSelected: { borderColor: colors.accent.primary, borderWidth: 2, ...elevation.raised },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border.default, alignItems: 'center', justifyContent: 'center' },
    radioSelected: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
    planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
    planTitle: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary },
    planLength: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: 2 },
    planPerMonth: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.secondary, marginTop: 2 },
    planPriceCol: { alignItems: 'flex-end' },
    planPrice: { fontFamily: typography.fonts.mono, fontSize: typography.sizes.lg, color: colors.text.primary },
    planPer: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.secondary },
    saveBadge:     { backgroundColor: colors.status.success, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
    saveBadgeText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.text.inverse },
    errorCard: { width: '100%', backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.base, marginBottom: spacing.base },
    errorText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, textAlign: 'center' },
    // text.secondary (not tertiary) — App Store 3.1.2 requires the
    // auto-renew/restore terms to be clearly readable; tertiary fails
    // WCAG AA contrast (~2.5:1) in light mode.
    footer: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm },
    autoRenewNote: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.base, paddingHorizontal: spacing.sm },
    legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xs },
    legalLink: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.text.secondary, textDecorationLine: 'underline' },
    legalDot: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },
    linkDisabled: { opacity: 0.4 },
  });
};

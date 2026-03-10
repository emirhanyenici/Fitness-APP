import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useNutritionStore, MealType } from '../../stores/nutritionStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { searchFoods, lookupBarcode, FoodItem } from '../../services/usda';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';

type Screen = 'home' | 'search' | 'manual' | 'barcode';

export default function AddFoodModal() {
  const { mealType = 'snack' } = useLocalSearchParams<{ mealType: string }>();
  const [screen, setScreen] = useState<Screen>('home');
  const addEntry = useNutritionStore((s) => s.addEntry);
  const isPro = useSubscriptionStore((s) => s.isPro);

  const handleAdd = useCallback((item: FoodItem) => {
    addEntry({
      name: item.description,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      mealType: mealType as MealType,
    });
    router.back();
  }, [mealType, addEntry]);

  if (screen === 'search')  return <SearchScreen  onAdd={handleAdd} onBack={() => setScreen('home')} />;
  if (screen === 'manual')  return <ManualScreen  onAdd={handleAdd} onBack={() => setScreen('home')} />;
  if (screen === 'barcode') return <BarcodeScreen onAdd={handleAdd} onBack={() => setScreen('home')} />;

  const mealLabel = (mealType as string).charAt(0).toUpperCase() + (mealType as string).slice(1);

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <Text style={styles.title}>Add Food</Text>
      <Text style={styles.sub}>Adding to {mealLabel}</Text>

      <View style={styles.grid}>
        {[
          { icon: '📷', label: 'Snap Photo',      sub: 'AI detects calories',  pro: true,  sc: null as Screen | null },
          { icon: '🔍', label: 'Search Database', sub: '3M+ foods (USDA)',     pro: false, sc: 'search'  as Screen },
          { icon: '📦', label: 'Scan Barcode',    sub: 'Scan packaging',        pro: false, sc: 'barcode' as Screen },
          { icon: '✏️', label: 'Enter Manually',  sub: 'Custom entry',          pro: false, sc: 'manual'  as Screen },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.label}
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => {
              if (opt.pro && !isPro) { router.push('/paywall'); return; }
              if (opt.sc) setScreen(opt.sc);
            }}
          >
            <Text style={styles.cardIcon}>{opt.icon}</Text>
            <Text style={styles.cardLabel}>{opt.label}</Text>
            <Text style={styles.cardSub}>{opt.sub}</Text>
            {opt.pro && (
              <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Search Screen ────────────────────────────────────────────────────────────

function SearchScreen({ onAdd, onBack }: { onAdd: (item: FoodItem) => void; onBack: () => void }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const foods = await searchFoods(query.trim());
      setResults(foods);
    } catch {
      Alert.alert('Error', 'Could not search foods. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <TouchableOpacity onPress={onBack}><Text style={styles.backLink}>← Back</Text></TouchableOpacity>
      <Text style={[styles.title, { marginTop: spacing.sm }]}>Search Food</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="e.g. chicken breast, apple..."
          placeholderTextColor={colors.text.tertiary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoFocus
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.fdcId)}
          style={{ marginTop: spacing.xs }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.resultRow} onPress={() => onAdd(item)} activeOpacity={0.75}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName} numberOfLines={2}>{item.description}</Text>
                <Text style={styles.resultMacros}>
                  P {item.protein}g · C {item.carbs}g · F {item.fat}g
                </Text>
              </View>
              <View style={styles.calBadge}>
                <Text style={styles.calNum}>{item.calories}</Text>
                <Text style={styles.calUnit}>kcal</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            searched && !loading ? (
              <Text style={styles.emptyText}>No results. Try a different term.</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ─── Manual Screen ────────────────────────────────────────────────────────────

function ManualScreen({ onAdd, onBack }: { onAdd: (item: FoodItem) => void; onBack: () => void }) {
  const [name,     setName]     = useState('');
  const [calories, setCalories] = useState('');
  const [protein,  setProtein]  = useState('');
  const [carbs,    setCarbs]    = useState('');
  const [fat,      setFat]      = useState('');

  const handleAdd = () => {
    if (!name.trim() || !calories.trim()) {
      Alert.alert('Required', 'Please enter at least food name and calories.');
      return;
    }
    onAdd({
      fdcId: 0,
      description: name.trim(),
      calories: parseInt(calories) || 0,
      protein:  parseInt(protein)  || 0,
      carbs:    parseInt(carbs)    || 0,
      fat:      parseInt(fat)      || 0,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={styles.handle} />
      <TouchableOpacity onPress={onBack}><Text style={styles.backLink}>← Back</Text></TouchableOpacity>
      <Text style={[styles.title, { marginTop: spacing.sm, marginBottom: spacing.xl }]}>Manual Entry</Text>

      <TextInput style={styles.input} placeholder="Food name *" placeholderTextColor={colors.text.tertiary}
        value={name} onChangeText={setName} />
      <View style={{ height: spacing.sm }} />
      <TextInput style={styles.input} placeholder="Calories (kcal) *" placeholderTextColor={colors.text.tertiary}
        value={calories} onChangeText={setCalories} keyboardType="numeric" />
      <View style={{ height: spacing.sm }} />
      <View style={styles.macroRow}>
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="Protein (g)"
          placeholderTextColor={colors.text.tertiary} value={protein} onChangeText={setProtein} keyboardType="numeric" />
        <View style={{ width: spacing.sm }} />
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="Carbs (g)"
          placeholderTextColor={colors.text.tertiary} value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
        <View style={{ width: spacing.sm }} />
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="Fat (g)"
          placeholderTextColor={colors.text.tertiary} value={fat} onChangeText={setFat} keyboardType="numeric" />
      </View>
      <View style={{ height: spacing.xl }} />
      <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>Add to Log</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Barcode Screen ───────────────────────────────────────────────────────────

function BarcodeScreen({ onAdd, onBack }: { onAdd: (item: FoodItem) => void; onBack: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned,  setScanned]  = useState(false);
  const [scanning, setScanning] = useState(false);
  const [found,    setFound]    = useState<FoodItem | null>(null);

  const handleBarcode = useCallback(async (result: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    setScanning(true);
    try {
      const food = await lookupBarcode(result.data);
      if (food) {
        setFound(food);
      } else {
        Alert.alert(
          'Not found',
          'Product not found in database. Try searching manually.',
          [
            { text: 'Search manually', onPress: onBack },
            { text: 'Scan again',      onPress: () => setScanned(false) },
          ]
        );
      }
    } catch {
      Alert.alert('Error', 'Could not look up product.');
      setScanned(false);
    } finally {
      setScanning(false);
    }
  }, [scanned, onBack]);

  if (!permission) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.accent.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.handle} />
        <Text style={[styles.title, { marginBottom: spacing.sm }]}>Camera Access</Text>
        <Text style={styles.permText}>Camera permission is required to scan barcodes.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: spacing.base }} onPress={onBack}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (found) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Product Found ✓</Text>
        <View style={styles.foundCard}>
          <Text style={styles.foundName}>{found.description}</Text>
          <View style={styles.foundMacros}>
            <MacroChip label="Cal"     value={String(found.calories)} color={colors.accent.primary} />
            <MacroChip label="Protein" value={`${found.protein}g`}    color={colors.status.info} />
            <MacroChip label="Carbs"   value={`${found.carbs}g`}      color={colors.status.warning} />
            <MacroChip label="Fat"     value={`${found.fat}g`}        color={colors.violet.primary} />
          </View>
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => onAdd(found)} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Add to Log</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: spacing.base }} onPress={() => { setFound(null); setScanned(false); }}>
          <Text style={styles.backLink}>Scan again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcode}
      />
      {scanning && (
        <View style={styles.scanOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.scanLoadText}>Looking up product...</Text>
        </View>
      )}
      <View style={styles.scanFrame} pointerEvents="none">
        <View style={styles.scanFrameBox} />
      </View>
      <View style={styles.scanBar}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.scanBarBack}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.scanBarHint}>Point at barcode</Text>
      </View>
    </View>
  );
}

function MacroChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.macroChip, { borderColor: color + '40' }]}>
      <Text style={[styles.macroChipVal, { color }]}>{value}</Text>
      <Text style={styles.macroChipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.tertiary, padding: spacing.base, paddingTop: spacing.lg },
  centered:  { justifyContent: 'center', alignItems: 'center' },

  handle:   { width: 40, height: 4, backgroundColor: colors.border.default, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.xl },
  title:    { fontFamily: typography.fonts.display, fontSize: typography.sizes.xl, color: colors.text.primary, marginBottom: spacing.xs },
  sub:      { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, marginBottom: spacing.xl },
  backLink: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.accent.primary, marginBottom: spacing.xs },

  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card:      { width: '48%', backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', gap: spacing.xs },
  cardIcon:  { fontSize: 32, marginBottom: spacing.xs },
  cardLabel: { fontFamily: typography.fonts.heading, fontSize: typography.sizes.base, color: colors.text.primary, textAlign: 'center' },
  cardSub:   { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.secondary, textAlign: 'center' },
  proBadge:  { backgroundColor: colors.accent.dim, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3, marginTop: spacing.xs },
  proBadgeText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.xs, color: colors.accent.primary },
  cancelBtn:  { marginTop: spacing.xl, alignItems: 'center', paddingVertical: spacing.base },
  cancelText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.secondary },

  searchRow:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  searchInput:   { flex: 1, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default, borderRadius: radius.lg, paddingHorizontal: spacing.base, paddingVertical: 12, color: colors.text.primary, fontFamily: typography.fonts.body, fontSize: typography.sizes.base },
  searchBtn:     { backgroundColor: colors.accent.primary, borderRadius: radius.lg, paddingHorizontal: spacing.base, justifyContent: 'center' },
  searchBtnText: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.inverse },

  resultRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border.subtle, gap: spacing.sm },
  resultName:   { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.primary, marginBottom: 3 },
  resultMacros: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },
  calBadge:     { alignItems: 'center', minWidth: 52 },
  calNum:       { fontFamily: typography.fonts.display, fontSize: typography.sizes.xl, color: colors.accent.primary },
  calUnit:      { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary },
  emptyText:    { fontFamily: typography.fonts.body, fontSize: typography.sizes.sm, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing['2xl'] },

  input:          { backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default, borderRadius: radius.lg, paddingHorizontal: spacing.base, paddingVertical: 13, color: colors.text.primary, fontFamily: typography.fonts.body, fontSize: typography.sizes.base },
  macroRow:       { flexDirection: 'row' },
  primaryBtn:     { backgroundColor: colors.accent.primary, borderRadius: radius.full, paddingVertical: 15, alignItems: 'center', width: '100%' },
  primaryBtnText: { fontFamily: typography.fonts.display, fontSize: typography.sizes.base, color: colors.text.inverse },

  permText: { fontFamily: typography.fonts.body, fontSize: typography.sizes.base, color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.xl, paddingHorizontal: spacing['2xl'] },

  scanOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', gap: spacing.base },
  scanLoadText: { color: '#fff', fontFamily: typography.fonts.body, fontSize: typography.sizes.base },
  scanFrame:    { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scanFrameBox: { width: 240, height: 150, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 12 },
  scanBar:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: spacing.xl, paddingHorizontal: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scanBarBack:  { color: '#fff', fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base },
  scanBarHint:  { color: 'rgba(255,255,255,0.65)', fontFamily: typography.fonts.body, fontSize: typography.sizes.sm },

  foundCard:      { backgroundColor: colors.bg.secondary, borderRadius: radius.xl, padding: spacing.xl, width: '100%', marginVertical: spacing.xl, borderWidth: 1, borderColor: colors.border.subtle },
  foundName:      { fontFamily: typography.fonts.heading, fontSize: typography.sizes.md, color: colors.text.primary, marginBottom: spacing.base, textAlign: 'center' },
  foundMacros:    { flexDirection: 'row', justifyContent: 'space-around' },
  macroChip:      { alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 10, paddingVertical: 8 },
  macroChipVal:   { fontFamily: typography.fonts.display, fontSize: typography.sizes.base },
  macroChipLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
});

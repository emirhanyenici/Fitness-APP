import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert, ScrollView, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useNutritionStore, MealType } from '../../stores/nutritionStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { searchFoods, searchFoodsOFF, lookupBarcode, scaleFood, FoodItem } from '../../services/usda';
import { analyzeFood, SnapResult } from '../../services/foodSnap';
import { colors, withAlpha } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { useT } from '../../constants/i18n';
import { Icon, Search, ScanBarcode, Keyboard, Camera, ImageIcon } from '../../components/ui/Icon';

type Screen = 'home' | 'search' | 'manual' | 'barcode' | 'snap';

export default function AddFoodModal() {
  const { mealType = 'snack' } = useLocalSearchParams<{ mealType: string }>();
  const [screen, setScreen] = useState<Screen>('home');
  const addEntry = useNutritionStore((s) => s.addEntry);
  const isPro = useSubscriptionStore((s) => s.isPro);
  const t = useT();

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
  if (screen === 'snap')    return <SnapScreen    onAdd={handleAdd} onBack={() => setScreen('home')} />;

  const mealKey = (mealType as string) === 'snack' ? 'nutrition.snacks' : `nutrition.${mealType}`;
  const mealLabel = t(mealKey);

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <Text style={styles.title}>{t('addFood.title')}</Text>
      <Text style={styles.sub}>{t('addFood.addingTo', { meal: mealLabel })}</Text>

      <View style={styles.grid}>
        {[
          { icon: Search,      label: t('addFood.searchDatabase'), sub: t('addFood.searchDatabaseSub'), pro: false, sc: 'search'  as Screen },
          { icon: ScanBarcode, label: t('addFood.scanBarcode'),    sub: t('addFood.scanBarcodeSub'),    pro: false, sc: 'barcode' as Screen },
          { icon: Keyboard,    label: t('addFood.enterManually'),  sub: t('addFood.enterManuallySub'),  pro: false, sc: 'manual'  as Screen },
          { icon: Camera,      label: t('addFood.snapPhoto'),      sub: t('addFood.snapPhotoSub'),      pro: true,  sc: 'snap'    as Screen },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.label}
            style={styles.card}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${opt.label}. ${opt.sub}${opt.pro ? '. ' + t('common.proFeature') : ''}`}
            onPress={() => {
              if (opt.pro && !isPro) { router.push('/paywall'); return; }
              if (opt.sc) setScreen(opt.sc);
            }}
          >
            <Icon icon={opt.icon} size="lg" color={colors.accent.primary} />
            <Text style={styles.cardLabel}>{opt.label}</Text>
            <Text style={styles.cardSub}>{opt.sub}</Text>
            {opt.pro && (
              <View style={styles.proBadge}><Text style={styles.proBadgeText}>{t('common.pro')}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('addFood.cancelClose')}
      >
        <Text style={styles.cancelText}>{t('common.cancel')}</Text>
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
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const t = useT();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const [usda, off] = await Promise.allSettled([
        searchFoods(query.trim()),
        searchFoodsOFF(query.trim()),
      ]);
      const combined = [
        ...(usda.status === 'fulfilled' ? usda.value : []),
        ...(off.status  === 'fulfilled' ? off.value  : []),
      ];
      if (combined.length === 0 && usda.status === 'rejected') {
        Alert.alert(t('common.error'), t('addFood.couldNotSearch'));
      }
      setResults(combined);
    } catch {
      Alert.alert('Error', 'Could not search foods. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Portion step — choose quantity/unit for the tapped result before logging.
  if (selected) {
    return (
      <PortionStep
        item={selected}
        onAdd={onAdd}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel={t('addFood.goBack')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={styles.backLink}>← {t('common.back')}</Text></TouchableOpacity>
      <Text style={[styles.title, { marginTop: spacing.sm }]}>{t('addFood.searchFood')}</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('addFood.searchPlaceholder')}
          placeholderTextColor={colors.text.tertiary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoFocus
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} accessibilityRole="button" accessibilityLabel={t('addFood.searchDbA11y')}>
          <Text style={styles.searchBtnText}>{t('addFood.search')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, index) => `${item.fdcId}_${index}`}
          style={{ marginTop: spacing.xs }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultRow}
              onPress={() => setSelected(item)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={t('addFood.addResultA11y', { name: item.description, calories: item.calories })}
            >
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
              <Text style={styles.emptyText}>{t('addFood.noResults')}</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ─── Portion Step (for a chosen search result) ────────────────────────────────

type PortionUnit = 'g' | 'serving';

function PortionStep({ item, onAdd, onBack }: { item: FoodItem; onAdd: (item: FoodItem) => void; onBack: () => void }) {
  const [unit, setUnit] = useState<PortionUnit>('g');
  const [qty,  setQty]  = useState('100');
  const t = useT();

  const amount = parseFloat(qty) || 0;
  const factor = unit === 'g' ? amount / 100 : amount;
  const scaled = scaleFood(item, factor);

  const switchUnit = (next: PortionUnit) => {
    if (next === unit) return;
    setUnit(next);
    setQty(next === 'g' ? '100' : '1');
  };

  const handleAdd = () => {
    if (amount <= 0) { Alert.alert(t('addFood.invalidAmount'), t('addFood.enterQtyPositive')); return; }
    const suffix = unit === 'g'
      ? t('addFood.gramSuffix', { n: amount })
      : t(amount === 1 ? 'addFood.servingSuffix' : 'addFood.servingSuffixPlural', { n: amount });
    onAdd({ ...scaled, description: `${item.description} (${suffix})` });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={styles.handle} />
      <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel={t('addFood.backToResults')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.backLink}>← {t('addFood.backToResults')}</Text>
      </TouchableOpacity>
      <Text style={[styles.title, { marginTop: spacing.sm }]}>{t('addFood.choosePortion')}</Text>

      <View style={[styles.foundCard, { width: '100%' }]}>
        <Text style={styles.foundName}>{item.description}</Text>

        {/* Unit toggle */}
        <View style={styles.unitToggle}>
          {(['g', 'serving'] as PortionUnit[]).map((u) => (
            <TouchableOpacity
              key={u}
              style={[styles.unitPill, unit === u && styles.unitPillActive]}
              onPress={() => switchUnit(u)}
              accessibilityRole="button"
              accessibilityState={{ selected: unit === u }}
              accessibilityLabel={u === 'g' ? t('addFood.measureGrams') : t('addFood.measureServings')}
            >
              <Text style={[styles.unitPillText, unit === u && styles.unitPillTextActive]}>
                {u === 'g' ? t('addFood.grams') : t('addFood.servings')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quantity input */}
        <View style={styles.gramRow}>
          <Text style={styles.gramLabel}>{t('addFood.amount')}</Text>
          <TextInput
            style={styles.gramInput}
            value={qty}
            onChangeText={setQty}
            keyboardType="decimal-pad"
            selectTextOnFocus
            maxLength={6}
            accessibilityLabel={t('addFood.portionAmount')}
          />
          <Text style={styles.gramUnit}>{unit === 'g' ? 'g' : '×'}</Text>
        </View>
        <Text style={styles.gramHint}>
          {unit === 'g' ? t('addFood.baseValues') : t('addFood.oneServing')}
        </Text>

        {/* Scaled macros */}
        <View style={styles.foundMacros}>
          <MacroChip label="Cal"     value={String(scaled.calories)} color={colors.accent.primary} />
          <MacroChip label="Protein" value={`${scaled.protein}g`}    color={colors.status.info} />
          <MacroChip label="Carbs"   value={`${scaled.carbs}g`}      color={colors.status.warning} />
          <MacroChip label="Fat"     value={`${scaled.fat}g`}        color={colors.violet.primary} />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, { width: '100%' }]}
        onPress={handleAdd}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('addFood.addToLogA11y', { name: item.description, calories: scaled.calories })}
      >
        <Text style={styles.primaryBtnText}>{t('addFood.addToLog')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Manual Screen ────────────────────────────────────────────────────────────

function ManualScreen({ onAdd, onBack }: { onAdd: (item: FoodItem) => void; onBack: () => void }) {
  const [name,     setName]     = useState('');
  const [calories, setCalories] = useState('');
  const [protein,  setProtein]  = useState('');
  const [carbs,    setCarbs]    = useState('');
  const [fat,      setFat]      = useState('');
  const [qty,      setQty]      = useState('1');
  const t = useT();

  const handleAdd = () => {
    if (!name.trim() || !calories.trim()) {
      Alert.alert(t('common.required'), t('addFood.requiredNameCal'));
      return;
    }
    const kcal = parseInt(calories) || 0;
    if (kcal < 0 || kcal > 9999) {
      Alert.alert(t('addFood.invalidCalories'), t('addFood.caloriesRange'));
      return;
    }
    const count = Math.max(1, parseInt(qty) || 1);
    const prot  = Math.max(0, parseInt(protein) || 0);
    const carb  = Math.max(0, parseInt(carbs)   || 0);
    const fatG  = Math.max(0, parseInt(fat)     || 0);
    const totalKcal = Math.min(9999, kcal * count);
    onAdd({
      fdcId: 0,
      description: count > 1 ? `${name.trim()} (×${count})` : name.trim(),
      calories: totalKcal,
      protein:  prot * count,
      carbs:    carb * count,
      fat:      fatG * count,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={styles.handle} />
      <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel={t('addFood.goBack')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={styles.backLink}>← {t('common.back')}</Text></TouchableOpacity>
      <Text style={[styles.title, { marginTop: spacing.sm, marginBottom: spacing.xl }]}>{t('addFood.manualEntry')}</Text>

      <TextInput style={styles.input} placeholder={t('addFood.foodNameReq')} placeholderTextColor={colors.text.tertiary}
        value={name} onChangeText={setName} />
      <View style={{ height: spacing.sm }} />
      <TextInput style={styles.input} placeholder={t('addFood.caloriesReq')} placeholderTextColor={colors.text.tertiary}
        value={calories} onChangeText={setCalories} keyboardType="numeric" />
      <View style={{ height: spacing.sm }} />
      <View style={styles.qtyRow}>
        <Text style={styles.qtyLabel}>{t('addFood.servingsX')}</Text>
        <TextInput style={styles.qtyInput} value={qty} onChangeText={setQty}
          keyboardType="numeric" selectTextOnFocus maxLength={3}
          accessibilityLabel={t('addFood.numberOfServings')} />
      </View>
      <View style={{ height: spacing.sm }} />
      <View style={styles.macroRow}>
        <TextInput style={[styles.input, { flex: 1 }]} placeholder={t('addFood.proteinG')}
          placeholderTextColor={colors.text.tertiary} value={protein} onChangeText={setProtein} keyboardType="numeric" />
        <View style={{ width: spacing.sm }} />
        <TextInput style={[styles.input, { flex: 1 }]} placeholder={t('addFood.carbsG')}
          placeholderTextColor={colors.text.tertiary} value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
        <View style={{ width: spacing.sm }} />
        <TextInput style={[styles.input, { flex: 1 }]} placeholder={t('addFood.fatG')}
          placeholderTextColor={colors.text.tertiary} value={fat} onChangeText={setFat} keyboardType="numeric" />
      </View>
      <View style={{ height: spacing.xl }} />
      <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('addFood.addToLog')}>
        <Text style={styles.primaryBtnText}>{t('addFood.addToLog')}</Text>
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
  const [grams,    setGrams]    = useState('100');
  const t = useT();

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
          t('addFood.notFound'),
          t('addFood.productNotFound'),
          [
            { text: t('addFood.searchManually'), onPress: onBack },
            { text: t('addFood.scanAgain'),      onPress: () => setScanned(false) },
          ]
        );
      }
    } catch {
      Alert.alert(t('common.error'), t('addFood.couldNotLookup'));
      setScanned(false);
    } finally {
      setScanning(false);
    }
  }, [scanned, onBack, t]);

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
        <Text style={[styles.title, { marginBottom: spacing.sm }]}>{t('addFood.cameraAccess')}</Text>
        <Text style={styles.permText}>{t('addFood.cameraPermMsg')}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission} accessibilityRole="button" accessibilityLabel={t('addFood.allowCameraA11y')}>
          <Text style={styles.primaryBtnText}>{t('addFood.allowCamera')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: spacing.base }} onPress={onBack} accessibilityRole="button" accessibilityLabel={t('addFood.goBack')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backLink}>← {t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (found) {
    const g      = parseFloat(grams) || 0;
    const scale  = g / 100;
    const scaled = {
      calories: Math.round(found.calories * scale),
      protein:  Math.round(found.protein  * scale * 10) / 10,
      carbs:    Math.round(found.carbs    * scale * 10) / 10,
      fat:      Math.round(found.fat      * scale * 10) / 10,
    };
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={styles.handle} />
        <Text style={styles.title}>{t('addFood.productFound')}</Text>
        <View style={[styles.foundCard, { width: '100%' }]}>
          <Text style={styles.foundName}>{found.description}</Text>

          {/* Gram input */}
          <View style={styles.gramRow}>
            <Text style={styles.gramLabel}>{t('addFood.portion')}</Text>
            <TextInput
              style={styles.gramInput}
              value={grams}
              onChangeText={setGrams}
              keyboardType="decimal-pad"
              selectTextOnFocus
              maxLength={6}
            />
            <Text style={styles.gramUnit}>g</Text>
          </View>
          <Text style={styles.gramHint}>{t('addFood.baseValues')}</Text>

          {/* Scaled macros */}
          <View style={styles.foundMacros}>
            <MacroChip label="Cal"     value={String(scaled.calories)}    color={colors.accent.primary} />
            <MacroChip label="Protein" value={`${scaled.protein}g`}       color={colors.status.info} />
            <MacroChip label="Carbs"   value={`${scaled.carbs}g`}         color={colors.status.warning} />
            <MacroChip label="Fat"     value={`${scaled.fat}g`}           color={colors.violet.primary} />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { width: '100%' }]}
          onPress={() => onAdd({ ...found, calories: scaled.calories, protein: scaled.protein, carbs: scaled.carbs, fat: scaled.fat })}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('addFood.addToLogA11y', { name: found.description, calories: scaled.calories })}
        >
          <Text style={styles.primaryBtnText}>{t('addFood.addToLog')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: spacing.base }} onPress={() => { setFound(null); setScanned(false); setGrams('100'); }} accessibilityRole="button" accessibilityLabel={t('addFood.scanAgain')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backLink}>{t('addFood.scanAgain')}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    // Intentional raw #000/#fff (like the BMI blue / YouTube red exceptions):
    // the camera viewport must stay true black with white chrome regardless of
    // the app palette.
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
          <Text style={styles.scanLoadText}>{t('addFood.lookingUp')}</Text>
        </View>
      )}
      <View style={styles.scanFrame} pointerEvents="none">
        <View style={styles.scanFrameBox} />
      </View>
      <View style={styles.scanBar}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel={t('addFood.goBack')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.scanBarBack}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.scanBarHint}>{t('addFood.pointAtBarcode')}</Text>
      </View>
    </View>
  );
}

// ─── Snap Screen ──────────────────────────────────────────────────────────────

function SnapScreen({ onAdd, onBack }: { onAdd: (item: FoodItem) => void; onBack: () => void }) {
  const [imageUri, setImageUri]     = useState<string | null>(null);
  const [imageB64, setImageB64]     = useState<string | null>(null);
  const [analyzing, setAnalyzing]   = useState(false);
  const [result, setResult]         = useState<SnapResult | null>(null);

  // Editable result fields
  const [editName,     setEditName]     = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editProtein,  setEditProtein]  = useState('');
  const [editCarbs,    setEditCarbs]    = useState('');
  const [editFat,      setEditFat]      = useState('');
  const [editQty,      setEditQty]      = useState('1');
  const t = useT();

  const applyResult = (r: SnapResult) => {
    setResult(r);
    setEditName(r.name);
    setEditCalories(String(r.calories));
    setEditProtein(String(r.protein));
    setEditCarbs(String(r.carbs));
    setEditFat(String(r.fat));
    setEditQty('1');
  };

  const pickImage = async (useCamera: boolean) => {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(t('common.permissionNeeded'), useCamera ? t('addFood.allowCameraMsg') : t('addFood.allowLibraryMsg'));
      return;
    }
    const res = useCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6, allowsEditing: true, aspect: [4, 3] })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6, allowsEditing: true, aspect: [4, 3], mediaTypes: ['images'] });

    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri);
      setImageB64(res.assets[0].base64 ?? null);
      setResult(null);
    }
  };

  const analyze = async () => {
    if (!imageB64) return;
    setAnalyzing(true);
    try {
      const r = await analyzeFood(imageB64);
      applyResult(r);
    } catch (e: any) {
      Alert.alert(t('addFood.analysisFailed'), e.message ?? t('addFood.couldNotIdentify'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAdd = () => {
    if (!editName.trim() || !editCalories.trim()) return;
    const count = Math.max(1, parseInt(editQty) || 1);
    onAdd({
      fdcId: 0,
      description: count > 1 ? `${editName.trim()} (×${count})` : editName.trim(),
      calories: (parseInt(editCalories) || 0) * count,
      protein:  (parseInt(editProtein)  || 0) * count,
      carbs:    (parseInt(editCarbs)    || 0) * count,
      fat:      (parseInt(editFat)      || 0) * count,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={styles.handle} />
      <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel={t('addFood.goBack')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={styles.backLink}>← {t('common.back')}</Text></TouchableOpacity>
      <Text style={[styles.title, { marginTop: spacing.sm, marginBottom: spacing.xs }]}>{t('addFood.snapPhoto')}</Text>
      <Text style={[styles.sub, { marginBottom: spacing.base }]}>{t('addFood.snapSubtitle')}</Text>

      {/* Pick buttons */}
      {!imageUri && (
        <View style={styles.snapPickRow}>
          <TouchableOpacity style={styles.snapPickBtn} onPress={() => pickImage(true)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('addFood.takePhotoA11y')}>
            <Icon icon={Camera} size={28} color={colors.accent.primary} strokeWidth={1.5} />
            <Text style={styles.snapPickLabel}>{t('addFood.takePhoto')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.snapPickBtn} onPress={() => pickImage(false)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('addFood.fromLibraryA11y')}>
            <Icon icon={ImageIcon} size={28} color={colors.accent.primary} strokeWidth={1.5} />
            <Text style={styles.snapPickLabel}>{t('addFood.fromLibrary')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Preview */}
      {imageUri && (
        <View style={{ alignItems: 'center', marginBottom: spacing.base }}>
          <Image source={{ uri: imageUri }} style={styles.snapPreview} />
          <TouchableOpacity onPress={() => { setImageUri(null); setImageB64(null); setResult(null); }} style={{ marginTop: spacing.sm }} accessibilityRole="button" accessibilityLabel={t('addFood.chooseDifferentA11y')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.backLink, { fontSize: typography.sizes.sm }]}>{t('addFood.chooseDifferent')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Analyze button */}
      {imageUri && !result && (
        <TouchableOpacity style={styles.primaryBtn} onPress={analyze} activeOpacity={0.85} disabled={analyzing} accessibilityRole="button" accessibilityLabel={t('addFood.analyzeFoodA11y')} accessibilityState={{ disabled: analyzing, busy: analyzing }}>
          {analyzing
            ? <ActivityIndicator color={colors.text.inverse} />
            : <Text style={styles.primaryBtnText}>{t('addFood.analyzeFood')}</Text>}
        </TouchableOpacity>
      )}

      {/* Result */}
      {result && (
        <View style={{ marginTop: spacing.base }}>
          <Text style={[styles.sub, { marginBottom: spacing.sm, color: colors.status.success }]}>{t('addFood.foodIdentified')}</Text>

          <TextInput style={[styles.input, { marginBottom: spacing.sm }]}
            value={editName} onChangeText={setEditName}
            placeholder={t('addFood.foodName')} placeholderTextColor={colors.text.tertiary} />

          <TextInput style={[styles.input, { marginBottom: spacing.sm }]}
            value={editCalories} onChangeText={setEditCalories}
            placeholder={t('addFood.calories')} placeholderTextColor={colors.text.tertiary} keyboardType="numeric" />

          <View style={styles.macroRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={editProtein} onChangeText={setEditProtein}
              placeholder={t('addFood.proteinG')} placeholderTextColor={colors.text.tertiary} keyboardType="numeric" />
            <View style={{ width: spacing.sm }} />
            <TextInput style={[styles.input, { flex: 1 }]} value={editCarbs} onChangeText={setEditCarbs}
              placeholder={t('addFood.carbsG')} placeholderTextColor={colors.text.tertiary} keyboardType="numeric" />
            <View style={{ width: spacing.sm }} />
            <TextInput style={[styles.input, { flex: 1 }]} value={editFat} onChangeText={setEditFat}
              placeholder={t('addFood.fatG')} placeholderTextColor={colors.text.tertiary} keyboardType="numeric" />
          </View>

          <View style={{ height: spacing.sm }} />
          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>{t('addFood.servingsX')}</Text>
            <TextInput style={styles.qtyInput} value={editQty} onChangeText={setEditQty}
              keyboardType="numeric" selectTextOnFocus maxLength={3}
              accessibilityLabel={t('addFood.numberOfServings')} />
          </View>

          <View style={{ height: spacing.xl }} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{t('addFood.addToLog')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: 'center', marginTop: spacing.base }} onPress={analyze} accessibilityRole="button" accessibilityLabel={t('addFood.reAnalyzeA11y')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backLink}>{t('addFood.reAnalyze')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
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

  snapPickRow:    { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  snapPickBtn:    { flex: 1, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.xl, paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm },
  snapPickLabel:  { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.primary },
  snapPreview:    { width: 220, height: 165, borderRadius: radius.xl, backgroundColor: colors.bg.elevated },

  foundCard:      { backgroundColor: colors.bg.secondary, borderRadius: radius.xl, padding: spacing.xl, width: '100%', marginVertical: spacing.xl, borderWidth: 1, borderColor: colors.border.subtle },
  foundName:      { fontFamily: typography.fonts.heading, fontSize: typography.sizes.md, color: colors.text.primary, marginBottom: spacing.base, textAlign: 'center' },
  foundMacros:    { flexDirection: 'row', justifyContent: 'space-around' },

  gramRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: 4 },
  gramLabel: { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.secondary },
  gramInput: { backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: withAlpha(colors.accent.primary, 0.38), borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, color: colors.text.primary, fontFamily: typography.fonts.display, fontSize: typography.sizes.xl, textAlign: 'center', minWidth: 80 },
  gramUnit:  { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.secondary },
  gramHint:  { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, textAlign: 'center', marginBottom: spacing.base },

  unitToggle:      { flexDirection: 'row', alignSelf: 'center', backgroundColor: colors.bg.elevated, borderRadius: radius.full, padding: 3, marginBottom: spacing.base, borderWidth: 1, borderColor: colors.border.subtle },
  unitPill:        { paddingHorizontal: spacing.xl, paddingVertical: 8, borderRadius: radius.full },
  unitPillActive:  { backgroundColor: colors.accent.primary },
  unitPillText:    { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.sm, color: colors.text.secondary },
  unitPillTextActive: { color: colors.text.inverse },

  qtyRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  qtyLabel:  { fontFamily: typography.fonts.bodyMed, fontSize: typography.sizes.base, color: colors.text.secondary },
  qtyInput:  { backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default, borderRadius: radius.lg, paddingHorizontal: spacing.base, paddingVertical: 12, color: colors.text.primary, fontFamily: typography.fonts.display, fontSize: typography.sizes.base, textAlign: 'center', minWidth: 70 },
  macroChip:      { alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: 10, paddingVertical: 8 },
  macroChipVal:   { fontFamily: typography.fonts.display, fontSize: typography.sizes.base },
  macroChipLabel: { fontFamily: typography.fonts.body, fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: 2 },
});

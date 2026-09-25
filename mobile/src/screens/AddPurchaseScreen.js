import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '../constants/theme';
import { addPurchaseEntry, getPastMedicineNames } from '../db/database';
import { calculateEntryDue, calculateLineTotal } from '../utils/khataLogic';

export default function AddPurchaseScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { customerId, customerName } = route.params;

  // Medicine list: array of { id, name, price, discount }
  const [medicines, setMedicines] = useState([
    { id: '1', name: '', price: '', discount: '' },
  ]);
  const [pastSuggestions, setPastSuggestions] = useState([]);
  const [amountPaid, setAmountPaid] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const names = getPastMedicineNames();
      setPastSuggestions(names);
    } catch (e) {
      console.warn('Could not load past medicine names:', e);
    }
  }, []);

  const addMedicineRow = () => {
    setMedicines((prev) => [
      ...prev,
      { id: String(Date.now() + Math.random()), name: '', price: '', discount: '' },
    ]);
  };

  const removeMedicineRow = (id) => {
    if (medicines.length === 1) {
      // Clear instead of removing last row
      setMedicines([{ id: '1', name: '', price: '', discount: '' }]);
      return;
    }
    setMedicines((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMedicine = (id, field, value) => {
    setMedicines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  // Autocomplete tap
  const selectSuggestion = (activeRowIndex, name) => {
    setMedicines((prev) => {
      const updated = [...prev];
      if (updated[activeRowIndex]) {
        updated[activeRowIndex].name = name;
      }
      return updated;
    });
  };

  // Calculations with percentage discount engine
  const calculatedTotal = medicines.reduce((sum, item) => {
    return sum + calculateLineTotal(item.price, item.discount);
  }, 0);

  const parsedPaid = parseFloat(amountPaid) || 0;
  const calculatedDue = calculateEntryDue(calculatedTotal, parsedPaid);

  const handleSave = () => {
    // Check if at least one medicine has a name or at least total > 0
    const validMeds = medicines
      .filter((m) => m.name.trim().length > 0)
      .map((m) => {
        const origPrice = parseFloat(m.price) || 0;
        const discPct = Math.min(100, Math.max(0, parseFloat(m.discount) || 0));
        const netPrice = calculateLineTotal(m.price, m.discount);
        return {
          name: m.name.trim(),
          price: netPrice,
          original_price: origPrice,
          discount_percent: discPct,
        };
      });

    if (validMeds.length === 0 && calculatedTotal === 0) {
      Alert.alert('Empty Entry', 'Please enter at least one medicine name or amount.');
      return;
    }

    setSaving(true);
    try {
      addPurchaseEntry({
        customerId,
        medicines: validMeds,
        totalAmount: calculatedTotal,
        amountPaid: parsedPaid,
      });

      navigation.goBack();
    } catch (err) {
      console.error('Error saving purchase:', err);
      Alert.alert('Save Failed', err.message || 'Could not save purchase entry');
    } finally {
      setSaving(false);
    }
  };

  const topPadding = Math.max(insets.top, (StatusBar.currentHeight || 0)) + SPACING.xs;

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Nav Bar with Settings Gear Icon in Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back">
              <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>New Purchase</Text>
              <Text style={styles.subtitle}>For {customerName}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('UserProfile')}
            accessibilityLabel="Settings"
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={17} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Quick Suggestions Chips - Wrapped so no truncation */}
          {pastSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Quick pick recent medicine:</Text>
              <View style={styles.chipsWrap}>
                {pastSuggestions.slice(0, 8).map((name, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.suggestionChip}
                    onPress={() => {
                      const lastIdx = medicines.length - 1;
                      if (!medicines[lastIdx].name) {
                        selectSuggestion(lastIdx, name);
                      } else {
                        setMedicines([...medicines, { id: String(Date.now() + Math.random()), name, price: '', discount: '' }]);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={12} color={COLORS.primary} style={{ marginRight: 2 }} />
                    <Text style={styles.suggestionChipText}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Medicines Entry Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>Medicines & Items</Text>

            {medicines.map((item, index) => {
              const hasDiscount = parseFloat(item.discount) > 0;
              const hasPrice = parseFloat(item.price) > 0;
              const netPrice = calculateLineTotal(item.price, item.discount);
              return (
                <View key={item.id} style={styles.medicineBlock}>
                  <View style={styles.medicineRow}>
                    <View style={styles.medicineNameCol}>
                      <TextInput
                        style={styles.medicineInput}
                        placeholder={`Medicine #${index + 1}`}
                        placeholderTextColor={COLORS.textTertiary}
                        value={item.name}
                        onChangeText={(val) => updateMedicine(item.id, 'name', val)}
                        autoCapitalize="words"
                      />
                    </View>

                    <View style={styles.priceCol}>
                      <TextInput
                        style={styles.priceInput}
                        placeholder="₹ Price"
                        placeholderTextColor={COLORS.textTertiary}
                        value={item.price}
                        onChangeText={(val) => updateMedicine(item.id, 'price', val)}
                        keyboardType="decimal-pad"
                      />
                    </View>

                    <View style={styles.discountCol}>
                      <TextInput
                        style={styles.discountInput}
                        placeholder="%"
                        placeholderTextColor={COLORS.textTertiary}
                        value={item.discount}
                        onChangeText={(val) => updateMedicine(item.id, 'discount', val)}
                        keyboardType="numeric"
                        maxLength={3}
                      />
                    </View>

                    <TouchableOpacity
                      onPress={() => removeMedicineRow(item.id)}
                      style={styles.deleteRowBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                      accessibilityLabel="Remove item"
                    >
                      <Ionicons name="trash-outline" size={16} color={COLORS.textTertiary} />
                    </TouchableOpacity>
                  </View>

                  {hasDiscount && hasPrice && (
                    <View style={styles.discountBadgeRow}>
                      <Ionicons name="pricetag-outline" size={12} color={COLORS.primary} style={{ marginRight: 4 }} />
                      <Text style={styles.discountBadgeText}>
                        Net: ₹{netPrice.toFixed(2)} ({item.discount}% off)
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Add Another Medicine Row */}
            <TouchableOpacity style={styles.addRowBtn} onPress={addMedicineRow}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.addRowBtnText}>Add Another Medicine</Text>
            </TouchableOpacity>
          </View>

          {/* Payment & Due Calculation Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>Payment Details</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Purchase:</Text>
              <Text style={styles.summaryValue}>₹{calculatedTotal.toFixed(2)}</Text>
            </View>

            <View style={styles.paymentInputRow}>
              <Text style={styles.paymentInputLabel}>Amount Paid Now (₹):</Text>
              <TextInput
                style={styles.paidNowInput}
                placeholder="0"
                placeholderTextColor={COLORS.textTertiary}
                value={amountPaid}
                onChangeText={setAmountPaid}
                keyboardType="numeric"
              />
            </View>

            {/* Live Due Summary */}
            <View style={styles.duePreviewBox}>
              <Text style={styles.duePreviewLabel}>Due Added to Khata:</Text>
              <Text
                style={[
                  styles.duePreviewAmount,
                  calculatedDue > 0 ? styles.dueTextAlert : styles.dueTextClear,
                ]}
              >
                ₹{calculatedDue.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            activeOpacity={0.85}
            onPress={handleSave}
            disabled={saving}
          >
            <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.textInverted} />
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Purchase Entry'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    marginRight: SPACING.sm,
    padding: SPACING.xs,
  },
  title: {
    ...FONTS.title,
    fontSize: 18,
  },
  subtitle: {
    ...FONTS.subtext,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  suggestionsContainer: {
    marginBottom: SPACING.sm,
  },
  suggestionsTitle: {
    ...FONTS.subtext,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  suggestionChipText: {
    ...FONTS.subtext,
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  card: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: SPACING.md,
  },
  cardHeaderTitle: {
    ...FONTS.header,
    fontSize: 15,
    marginBottom: SPACING.sm,
    color: COLORS.textPrimary,
  },
  medicineBlock: {
    marginBottom: SPACING.sm,
  },
  medicineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  medicineNameCol: {
    flex: 1,
    minWidth: 110,
  },
  priceCol: {
    width: 95,
  },
  discountCol: {
    width: 48,
  },
  medicineInput: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm + 2,
    height: 42,
    ...FONTS.body,
    fontSize: 14,
  },
  priceInput: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    height: 42,
    ...FONTS.body,
    fontSize: 14,
    textAlign: 'right',
  },
  discountInput: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 2,
    height: 42,
    ...FONTS.body,
    fontSize: 14,
    textAlign: 'center',
  },
  discountBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    marginLeft: SPACING.xs,
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  deleteRowBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.primaryBorder,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    gap: 6,
    marginTop: 2,
  },
  addRowBtnText: {
    ...FONTS.bodySecondary,
    fontWeight: '600',
    color: COLORS.primary,
    fontSize: 13,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceSubtle,
  },
  summaryLabel: {
    ...FONTS.body,
    fontWeight: '600',
  },
  summaryValue: {
    ...FONTS.title,
    fontSize: 17,
  },
  paymentInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  paymentInputLabel: {
    ...FONTS.body,
  },
  paidNowInput: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 42,
    width: 120,
    textAlign: 'right',
    ...FONTS.header,
    fontSize: 16,
  },
  duePreviewBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  duePreviewLabel: {
    ...FONTS.bodySecondary,
    fontWeight: '600',
  },
  duePreviewAmount: {
    ...FONTS.header,
    fontSize: 16,
  },
  dueTextAlert: {
    color: COLORS.dueBadgeText,
  },
  dueTextClear: {
    color: COLORS.paymentGreen,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: RADIUS.pill,
    gap: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...FONTS.body,
    fontWeight: '700',
    color: COLORS.textInverted,
    fontSize: 16,
  },
});

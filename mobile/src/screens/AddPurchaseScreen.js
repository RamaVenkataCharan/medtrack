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
  ActivityIndicator,
  SafeAreaView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, TOUCH_TARGETS } from '../constants/theme';
import {
  addPurchaseEntry,
  getPastMedicineNames,
  searchCustomers,
} from '../db/database';
import Avatar from '../components/Avatar';
import NetworkBanner from '../components/NetworkBanner';

export default function AddPurchaseScreen({ route, navigation }) {
  const initialCustomerId = route.params?.customerId || null;
  const initialCustomer = route.params?.customer || null;

  const [selectedCustomer, setSelectedCustomer] = useState(
    initialCustomer || (initialCustomerId ? { customer_id: initialCustomerId, name: route.params?.customerName } : null)
  );

  // Customer search picker modal state if no customer selected
  const [customerPickerVisible, setCustomerPickerVisible] = useState(!initialCustomerId);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  // Medicine list: array of { id, name, quantity, unit_price }
  const [medicines, setMedicines] = useState([
    { id: '1', name: '', quantity: 1, unit_price: '' },
  ]);
  const [pastSuggestions, setPastSuggestions] = useState([]);
  const [notes, setNotes] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPastMedicineNames()
      .then((names) => {
        if (Array.isArray(names)) setPastSuggestions(names);
      })
      .catch((e) => {
        console.warn('Could not load past medicine names:', e);
      });
  }, []);

  // Search customers for picker
  useEffect(() => {
    let active = true;
    if (customerPickerVisible) {
      setSearchingCustomers(true);
      searchCustomers(customerSearchQuery)
        .then((res) => {
          if (active) setCustomerSearchResults(res || []);
        })
        .finally(() => {
          if (active) setSearchingCustomers(false);
        });
    }
    return () => {
      active = false;
    };
  }, [customerSearchQuery, customerPickerVisible]);

  const addMedicineRow = () => {
    setMedicines((prev) => [
      ...prev,
      { id: String(Date.now() + Math.random()), name: '', quantity: 1, unit_price: '' },
    ]);
  };

  const removeMedicineRow = (id) => {
    if (medicines.length === 1) {
      setMedicines([{ id: '1', name: '', quantity: 1, unit_price: '' }]);
      return;
    }
    setMedicines((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMedicine = (id, field, value) => {
    setMedicines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const incrementQty = (id) => {
    setMedicines((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, quantity: Math.max(1, (parseInt(m.quantity, 10) || 1) + 1) } : m
      )
    );
  };

  const decrementQty = (id) => {
    setMedicines((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, quantity: Math.max(1, (parseInt(m.quantity, 10) || 1) - 1) } : m
      )
    );
  };

  const selectSuggestion = (name) => {
    const emptyRow = medicines.find((m) => !m.name.trim());
    if (emptyRow) {
      updateMedicine(emptyRow.id, 'name', name);
    } else {
      setMedicines([
        ...medicines,
        { id: String(Date.now() + Math.random()), name, quantity: 1, unit_price: '' },
      ]);
    }
  };

  // Calculations
  const calculatedTotal = medicines.reduce((sum, item) => {
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const price = Math.max(0, parseFloat(item.unit_price) || 0);
    return sum + qty * price;
  }, 0);

  // If amountPaid is empty, default to full payment (calculatedTotal); if explicitly 0, keep 0
  const parsedPaid = amountPaid.trim() === ''
    ? calculatedTotal
    : Math.max(0, parseFloat(amountPaid) || 0);
  const calculatedDue = Math.max(0, calculatedTotal - parsedPaid);

  const handleSave = async () => {
    if (!selectedCustomer) {
      setCustomerPickerVisible(true);
      return;
    }

    const validMeds = medicines
      .filter((m) => (m.name || '').trim().length > 0)
      .map((m) => {
        const qty = Math.max(1, parseInt(m.quantity, 10) || 1);
        const uPrice = Math.max(0, parseFloat(m.unit_price) || 0);
        return {
          name: m.name.trim(),
          quantity: qty,
          unit_price: uPrice,
          price: qty * uPrice,
          original_price: qty * uPrice,
          discount_percent: 0,
        };
      });

    if (validMeds.length === 0 && calculatedTotal === 0) {
      const msg = 'Please enter at least one medicine or purchase amount.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Empty Purchase', msg);
      return;
    }

    for (const m of validMeds) {
      if (m.quantity < 1) {
        const msg = `Quantity for "${m.name}" must be at least 1.`;
        Platform.OS === 'web' ? alert(msg) : Alert.alert('Invalid Quantity', msg);
        return;
      }
      if (m.unit_price < 0) {
        const msg = `Rate for "${m.name}" cannot be negative.`;
        Platform.OS === 'web' ? alert(msg) : Alert.alert('Invalid Rate', msg);
        return;
      }
    }

    if (parsedPaid < 0) {
      const msg = 'Amount paid cannot be negative.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Invalid Payment', msg);
      return;
    }

    setSaving(true);
    try {
      const newEntryId = await addPurchaseEntry({
        customerId: selectedCustomer.customer_id,
        medicines: validMeds,
        totalAmount: calculatedTotal,
        amountPaid: parsedPaid,
        notes: notes.trim(),
      });

      // Navigate to Screen 9: Purchase Saved Successfully!
      navigation.replace('PurchaseSuccess', {
        entryId: newEntryId,
        customerName: selectedCustomer.name,
        medicineCount: validMeds.length,
        totalAmount: calculatedTotal,
        entryDate: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Error saving purchase:', err);
      const errMsg = err.message || 'Could not save purchase entry. Please check your connection and try again.';
      Platform.OS === 'web' ? alert(`Save Failed: ${errMsg}`) : Alert.alert('Save Failed', errMsg);
      // Notice: Form state is completely preserved so user does not lose entered data!
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <NetworkBanner />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Record Purchase</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Selected Customer Bar (Screen 8 in roadmap) */}
          <View style={styles.customerBar}>
            {selectedCustomer ? (
              <>
                <Avatar name={selectedCustomer.name} size={44} />
                <View style={styles.customerMeta}>
                  <Text style={styles.customerName}>{selectedCustomer.name}</Text>
                  <Text style={styles.customerPhone}>
                    {selectedCustomer.phone_number || 'No phone'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeCustomerBtn}
                  onPress={() => setCustomerPickerVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Change customer"
                >
                  <Text style={styles.changeCustomerText}>Change</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.selectCustomerPrompt}
                onPress={() => setCustomerPickerVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Select customer for this purchase"
              >
                <Ionicons name="person-add" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={styles.selectCustomerPromptText}>Select Customer *</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Suggestions Chips */}
          {pastSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Quick add frequent medicine:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {pastSuggestions.slice(0, 10).map((name, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.suggestionChip}
                    onPress={() => selectSuggestion(name)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={14} color={COLORS.primary} style={{ marginRight: 2 }} />
                    <Text style={styles.suggestionChipText}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Medicine List Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Medicines</Text>
          </View>

          {medicines.map((item, index) => {
            const qty = item.quantity || 1;
            const unitPrice = parseFloat(item.unit_price) || 0;
            const rowTotal = qty * unitPrice;

            return (
              <View key={item.id} style={styles.medicineCard}>
                <View style={styles.cardTopRow}>
                  <View style={styles.medIndexWrap}>
                    <Text style={styles.medIndexText}>{index + 1}</Text>
                  </View>
                  <TextInput
                    style={styles.medNameInput}
                    value={item.name}
                    onChangeText={(val) => updateMedicine(item.id, 'name', val)}
                    placeholder="Medicine name (e.g. Paracetamol 500mg)"
                    placeholderTextColor={COLORS.textMuted}
                    accessibilityLabel={`Medicine ${index + 1} Name`}
                  />
                  {medicines.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeMedicineRow(item.id)}
                      style={styles.removeRowBtn}
                      accessibilityLabel="Remove medicine"
                    >
                      <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Stepper + Rate Row */}
                <View style={styles.cardBottomRow}>
                  {/* Stepper Control */}
                  <View style={styles.stepperControl}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => decrementQty(item.id)}
                      accessibilityLabel="Decrease quantity"
                    >
                      <Ionicons name="remove" size={18} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{qty}</Text>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => incrementQty(item.id)}
                      accessibilityLabel="Increase quantity"
                    >
                      <Ionicons name="add" size={18} color={COLORS.text} />
                    </TouchableOpacity>
                  </View>

                  {/* Unit Price Input */}
                  <View style={styles.rateInputWrap}>
                    <Text style={styles.rateSymbol}>₹</Text>
                    <TextInput
                      style={styles.rateInput}
                      value={String(item.unit_price || '')}
                      onChangeText={(val) => updateMedicine(item.id, 'unit_price', val)}
                      placeholder="Rate"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numeric"
                      accessibilityLabel="Rate per unit"
                    />
                  </View>

                  {/* Calculated Line Total */}
                  <View style={styles.lineTotalWrap}>
                    <Text style={styles.lineTotalLabel}>Line Total</Text>
                    <Text style={styles.lineTotalAmount}>₹{rowTotal.toFixed(0)}</Text>
                  </View>
                </View>
              </View>
            );
          })}

          {/* + Add Medicine Button */}
          <TouchableOpacity
            style={styles.addMedicineBtn}
            onPress={addMedicineRow}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Add Medicine"
          >
            <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.addMedicineBtnText}>+ Add Medicine</Text>
          </TouchableOpacity>

          {/* Optional Notes */}
          <View style={styles.notesGroup}>
            <Text style={styles.notesLabel}>Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Regular monthly medicines, morning/night dosage"
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Summary / Total Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>Total Amount</Text>
              <Text style={styles.summaryTotalValue}>₹{calculatedTotal.toFixed(0)}</Text>
            </View>

            <View style={styles.paidInputRow}>
              <Text style={styles.paidLabel}>Amount Paid (₹)</Text>
              <TextInput
                style={styles.paidInput}
                value={amountPaid}
                onChangeText={setAmountPaid}
                placeholder={calculatedTotal > 0 ? String(calculatedTotal.toFixed(0)) : '0'}
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />
            </View>

            {calculatedDue > 0 && (
              <View style={styles.dueRow}>
                <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                <Text style={styles.dueText}>Remaining Due: ₹{calculatedDue.toFixed(0)}</Text>
              </View>
            )}
          </View>

          {/* Save Purchase Primary Button */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save Purchase"
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save Purchase</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Customer Picker Modal */}
      <Modal
        visible={customerPickerVisible}
        animationType="slide"
        onRequestClose={() => {
          if (selectedCustomer) setCustomerPickerVisible(false);
          else navigation.goBack();
        }}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity
              onPress={() => {
                if (selectedCustomer) setCustomerPickerVisible(false);
                else navigation.goBack();
              }}
              style={styles.backButton}
            >
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Select Customer</Text>
            <TouchableOpacity
              onPress={() => {
                setCustomerPickerVisible(false);
                navigation.navigate('AddCustomer');
              }}
              style={styles.pickerAddBtn}
            >
              <Ionicons name="person-add" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.pickerSearchWrap}>
            <Ionicons name="search" size={20} color={COLORS.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.pickerSearchInput}
              placeholder="Search customer by name or phone..."
              placeholderTextColor={COLORS.textMuted}
              value={customerSearchQuery}
              onChangeText={setCustomerSearchQuery}
              autoFocus
            />
          </View>

          {searchingCustomers ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.pickerList}>
              {customerSearchResults.map((c) => (
                <TouchableOpacity
                  key={c.customer_id}
                  style={styles.pickerItem}
                  onPress={() => {
                    setSelectedCustomer(c);
                    setCustomerPickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Avatar name={c.name} size={42} />
                  <View style={styles.pickerItemMeta}>
                    <Text style={styles.pickerItemName}>{c.name}</Text>
                    <Text style={styles.pickerItemPhone}>{c.phone_number || 'No phone'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'android' ? 12 : SPACING.sm,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: TOUCH_TARGETS.minWidth,
    height: TOUCH_TARGETS.minHeight,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 20,
    color: COLORS.text,
    fontWeight: '700',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  customerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  customerMeta: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  customerName: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  customerPhone: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  changeCustomerBtn: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
  },
  changeCustomerText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
  },
  selectCustomerPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: SPACING.sm,
  },
  selectCustomerPromptText: {
    ...TYPOGRAPHY.label,
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '700',
  },
  suggestionsContainer: {
    marginBottom: SPACING.md,
  },
  suggestionsTitle: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  suggestionChipText: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.text,
  },
  sectionHeader: {
    marginBottom: SPACING.xs,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  medicineCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  medIndexWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.xs,
  },
  medIndexText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  medNameInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.text,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  removeRowBtn: {
    padding: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.xs,
  },
  stepperControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    ...TYPOGRAPHY.label,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    paddingHorizontal: 8,
  },
  rateInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.background,
    height: 36,
    width: 90,
  },
  rateSymbol: {
    ...TYPOGRAPHY.caption,
    fontSize: 14,
    color: COLORS.textMuted,
    marginRight: 4,
  },
  rateInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 2,
  },
  lineTotalWrap: {
    alignItems: 'flex-end',
  },
  lineTotalLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  lineTotalAmount: {
    ...TYPOGRAPHY.label,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  addMedicineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    minHeight: TOUCH_TARGETS.minHeight,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.md,
  },
  addMedicineBtnText: {
    ...TYPOGRAPHY.label,
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '700',
  },
  notesGroup: {
    marginBottom: SPACING.md,
  },
  notesLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  notesInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 56,
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  summaryTotalLabel: {
    ...TYPOGRAPHY.h3,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  summaryTotalValue: {
    ...TYPOGRAPHY.h2,
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  paidInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  paidLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  paidInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    minWidth: 100,
    textAlign: 'right',
    ...TYPOGRAPHY.label,
    fontSize: 15,
    color: COLORS.text,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: SPACING.xs,
  },
  dueText: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.error,
    marginLeft: 4,
  },
  saveBtn: {
    minHeight: TOUCH_TARGETS.minHeight,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnText: {
    ...TYPOGRAPHY.label,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  pickerAddBtn: {
    width: TOUCH_TARGETS.minWidth,
    height: TOUCH_TARGETS.minHeight,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  pickerSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerSearchInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.text,
  },
  pickerList: {
    padding: SPACING.md,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerItemMeta: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  pickerItemName: {
    ...TYPOGRAPHY.label,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  pickerItemPhone: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

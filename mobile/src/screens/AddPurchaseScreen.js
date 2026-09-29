import React, { useState, useEffect, useRef } from 'react';
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
  updatePurchaseEntry,
  getPastMedicineNames,
  searchCustomers,
} from '../db/database';
import Avatar from '../components/Avatar';
import NetworkBanner from '../components/NetworkBanner';

const UNITS = ['tablets', 'strips', 'capsules', 'bottles', 'boxes', 'units'];

export default function AddPurchaseScreen({ route, navigation }) {
  const initialCustomerId = route.params?.customerId || null;
  const initialCustomer = route.params?.customer || null;
  const editEntry = route.params?.editEntry || null;

  const [selectedCustomer, setSelectedCustomer] = useState(
    initialCustomer || (initialCustomerId ? { customer_id: initialCustomerId, name: route.params?.customerName } : null)
  );

  // Customer search picker modal
  const [customerPickerVisible, setCustomerPickerVisible] = useState(!initialCustomerId && !initialCustomer);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  // Medicine list: array of { id, name, quantity, unit, unit_price }
  const [medicines, setMedicines] = useState(
    editEntry?.medicines?.length
      ? editEntry.medicines.map((m, idx) => ({
          id: String(m.id || idx),
          name: m.medicine_name || m.name || '',
          quantity: m.quantity || 1,
          unit: m.unit || 'tablets',
          unit_price: m.unit_price || m.price ? String(m.unit_price || m.price) : '',
        }))
      : [{ id: '1', name: '', quantity: 10, unit: 'tablets', unit_price: '' }]
  );

  const [pastSuggestions, setPastSuggestions] = useState([]);
  const [notes, setNotes] = useState(editEntry?.notes || '');
  const [amountPaid, setAmountPaid] = useState(editEntry?.amount_paid ? String(editEntry.amount_paid) : '');
  const [saving, setSaving] = useState(false);
  const [activeUnitPickerIdx, setActiveUnitPickerIdx] = useState(null);
  const savingRef = useRef(false);

  // Format today's date: "Today · 29 Sep 2026"
  const todayFormatted = `Today · ${new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}`;

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
      {
        id: String(Date.now() + Math.random()),
        name: '',
        quantity: 1,
        unit: 'tablets',
        unit_price: '',
      },
    ]);
  };

  const removeMedicineRow = (id) => {
    if (medicines.length === 1) {
      setMedicines([{ id: '1', name: '', quantity: 1, unit: 'tablets', unit_price: '' }]);
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

  const selectSuggestion = (targetId, name) => {
    updateMedicine(targetId, 'name', name);
  };

  // Calculations
  const calculatedTotal = medicines.reduce((sum, item) => {
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const price = Math.max(0, parseFloat(item.unit_price) || 0);
    return sum + qty * price;
  }, 0);

  const parsedPaid = amountPaid.trim() === '' ? calculatedTotal : Math.max(0, parseFloat(amountPaid) || 0);
  const dueAmountCalculated = Math.max(0, calculatedTotal - parsedPaid);

  const handleSave = async () => {
    if (savingRef.current) return;

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
          unit: m.unit || 'units',
          unit_price: uPrice,
          price: qty * uPrice,
        };
      });

    if (validMeds.length === 0 && calculatedTotal === 0) {
      const msg = 'Please enter at least one medicine.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Empty Purchase', msg);
      return;
    }

    const finalTotal = calculatedTotal;
    const finalPaid = amountPaid.trim() === '' ? finalTotal : Math.max(0, parseFloat(amountPaid) || 0);

    savingRef.current = true;
    setSaving(true);
    try {
      if (editEntry?.entry_id) {
        await updatePurchaseEntry({
          entryId: editEntry.entry_id,
          customerId: selectedCustomer.customer_id,
          medicines: validMeds,
          totalAmount: finalTotal,
          amountPaid: finalPaid,
          notes: notes.trim(),
        });
      } else {
        await addPurchaseEntry({
          customerId: selectedCustomer.customer_id,
          medicines: validMeds,
          totalAmount: finalTotal,
          amountPaid: finalPaid,
          notes: notes.trim(),
        });
      }

      // Navigate to confirmation or back
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('CustomerProfile', {
          customerId: selectedCustomer.customer_id,
          customer: selectedCustomer,
        });
      }
    } catch (err) {
      console.warn('Error saving purchase:', err);
      const errMsg = err.message || 'Could not save purchase entry.';
      Platform.OS === 'web' ? alert(`Save Failed: ${errMsg}`) : Alert.alert('Save Failed', errMsg);
    } finally {
      savingRef.current = false;
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            testID="purchase-back-btn"
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{editEntry ? 'Edit purchase' : 'Record purchase'}</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Customer Selection Card */}
          <TouchableOpacity
            style={styles.customerCard}
            onPress={() => setCustomerPickerVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={selectedCustomer ? `Customer: ${selectedCustomer.name}` : 'Select Customer'}
          >
            {selectedCustomer ? (
              <>
                <Avatar name={selectedCustomer.name} size={44} showBorder />
                <View style={styles.customerMeta}>
                  <Text style={styles.customerName} numberOfLines={1}>
                    {selectedCustomer.name}
                  </Text>
                  <Text style={styles.customerPhone}>
                    {selectedCustomer.phone_number || 'No phone'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </>
            ) : (
              <View style={styles.noCustomerRow}>
                <Ionicons name="person-add-outline" size={22} color={COLORS.primary} style={{ marginRight: 10 }} />
                <Text style={styles.selectCustomerPrompt}>Select a customer...</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </View>
            )}
          </TouchableOpacity>

          {/* Date Selector Row */}
          <View style={styles.dateSelectorCard}>
            <View style={styles.dateLeft}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.primary} style={{ marginRight: 12 }} />
              <View>
                <Text style={styles.dateLabel}>Date</Text>
                <Text style={styles.dateValue}>{todayFormatted}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </View>

          {/* Medicines Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Medicines</Text>
          </View>

          {medicines.map((med, index) => {
            // Filter suggestions matching the typed text
            const suggestions = pastSuggestions.filter(
              (s) =>
                med.name.trim().length > 1 &&
                s.toLowerCase().includes(med.name.toLowerCase().trim()) &&
                s.toLowerCase() !== med.name.toLowerCase().trim()
            ).slice(0, 3);

            return (
              <View key={med.id} style={styles.medicineCard}>
                {/* Medicine Name Field */}
                <Text style={styles.inputLabel}>Medicine name</Text>
                <TextInput
                  style={styles.medicineNameInput}
                  value={med.name}
                  onChangeText={(val) => updateMedicine(med.id, 'name', val)}
                  placeholder="e.g. Paracetamol 500 mg"
                  placeholderTextColor={COLORS.textMuted}
                />

                {/* Autocomplete suggestions chips */}
                {suggestions.length > 0 && (
                  <View style={styles.suggestionsRow}>
                    {suggestions.map((sug) => (
                      <TouchableOpacity
                        key={sug}
                        style={styles.suggestionChip}
                        onPress={() => selectSuggestion(med.id, sug)}
                      >
                        <Text style={styles.suggestionChipText}>{sug}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Quantity & Unit Stepper Row */}
                <View style={styles.qtyPriceRow}>
                  <View style={styles.qtyCol}>
                    <Text style={styles.inputLabel}>Quantity</Text>
                    <View style={styles.stepperContainer}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => decrementQty(med.id)}
                        accessibilityLabel="Decrease quantity"
                      >
                        <Ionicons name="remove" size={18} color={COLORS.text} />
                      </TouchableOpacity>

                      <Text style={styles.qtyValue}>{med.quantity}</Text>

                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => incrementQty(med.id)}
                        accessibilityLabel="Increase quantity"
                      >
                        <Ionicons name="add" size={18} color={COLORS.text} />
                      </TouchableOpacity>

                      {/* Unit dropdown toggle */}
                      <TouchableOpacity
                        style={styles.unitDropdownBtn}
                        onPress={() => setActiveUnitPickerIdx(index)}
                      >
                        <Text style={styles.unitDropdownText}>{med.unit}</Text>
                        <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Delete Item Button */}
                  <TouchableOpacity
                    style={styles.deleteMedBtn}
                    onPress={() => removeMedicineRow(med.id)}
                    accessibilityLabel="Remove medicine"
                  >
                    <Ionicons name="trash-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>

                {/* Optional Unit Price Row */}
                <View style={styles.priceRow}>
                  <Text style={styles.priceRowLabel}>Rate (₹ optional):</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={med.unit_price}
                    onChangeText={(val) => updateMedicine(med.id, 'unit_price', val)}
                    placeholder="₹0"
                    keyboardType="numeric"
                    placeholderTextColor={COLORS.textMuted}
                  />
                  {parseFloat(med.unit_price) > 0 && (
                    <Text style={styles.lineTotalText}>
                      Total: ₹{(med.quantity * parseFloat(med.unit_price)).toFixed(0)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}

          {/* Add Another Medicine Button */}
          <TouchableOpacity
            style={styles.addMedBtn}
            onPress={addMedicineRow}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add another medicine"
          >
            <Ionicons name="add" size={20} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.addMedBtnText}>Add another medicine</Text>
          </TouchableOpacity>

          {/* Optional Note Section */}
          <View style={styles.noteSection}>
            <Text style={styles.sectionTitle}>Note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add a note..."
              placeholderTextColor={COLORS.textMuted}
              multiline
            />
          </View>

          {/* Total & Payment Summary Card */}
          {calculatedTotal > 0 && (
            <View style={styles.totalSummaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.totalSummaryLabel}>Total Bill</Text>
                <Text style={styles.totalSummaryValue}>₹{calculatedTotal.toFixed(0)}</Text>
              </View>

              {/* Amount Paid Row */}
              <View style={styles.paidInputRow}>
                <Text style={styles.paidLabel}>Amount Paid</Text>
                <View style={styles.paidInputWrap}>
                  <Text style={styles.rupeePrefix}>₹</Text>
                  <TextInput
                    testID="purchase-paid-input"
                    style={styles.paidInput}
                    placeholder={calculatedTotal > 0 ? String(calculatedTotal.toFixed(0)) : '0'}
                    placeholderTextColor={COLORS.textMuted}
                    value={amountPaid}
                    onChangeText={setAmountPaid}
                    keyboardType="numeric"
                    accessibilityLabel="Amount Paid"
                  />
                </View>
              </View>

              {/* Quick Presets */}
              <View style={styles.paymentPresetRow}>
                <TouchableOpacity
                  style={[
                    styles.paymentPresetPill,
                    (amountPaid === '' || parseFloat(amountPaid) === calculatedTotal) && styles.paymentPresetPillActive,
                  ]}
                  onPress={() => setAmountPaid(calculatedTotal > 0 ? String(calculatedTotal.toFixed(0)) : '')}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Paid in full"
                >
                  <Text
                    style={[
                      styles.paymentPresetPillText,
                      (amountPaid === '' || parseFloat(amountPaid) === calculatedTotal) && styles.paymentPresetPillTextActive,
                    ]}
                  >
                    Paid in full
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentPresetPill,
                    amountPaid === '0' && styles.paymentPresetPillActive,
                  ]}
                  onPress={() => setAmountPaid('0')}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Credit / Udhar (Zero paid)"
                >
                  <Text
                    style={[
                      styles.paymentPresetPillText,
                      amountPaid === '0' && styles.paymentPresetPillTextActive,
                    ]}
                  >
                    Credit / Udhar (₹0)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Due Summary */}
              <View style={styles.dueSummaryRow}>
                <Text style={styles.dueSummaryLabel}>Balance Due</Text>
                <Text
                  style={[
                    styles.dueSummaryValue,
                    dueAmountCalculated > 0 ? styles.dueSummaryValueOwed : styles.dueSummaryValueSettled,
                  ]}
                >
                  {dueAmountCalculated > 0 ? `₹${dueAmountCalculated.toFixed(0)} (Due)` : '₹0 (Settled)'}
                </Text>
              </View>
            </View>
          )}

          {/* Save Purchase Button */}
          <TouchableOpacity
            testID="purchase-save-btn"
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save purchase"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>{editEntry ? 'Save changes' : 'Save purchase'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Customer Picker Modal */}
      <Modal
        visible={customerPickerVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          if (selectedCustomer) setCustomerPickerVisible(false);
        }}
      >
        <SafeAreaView style={styles.pickerSafeArea}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (selectedCustomer) setCustomerPickerVisible(false);
                else navigation.goBack();
              }}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Select Customer</Text>
            <TouchableOpacity
              onPress={() => {
                setCustomerPickerVisible(false);
                navigation.navigate('AddCustomer');
              }}
            >
              <Ionicons name="person-add-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.pickerSearchContainer}>
            <Ionicons name="search" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.pickerSearchInput}
              value={customerSearchQuery}
              onChangeText={setCustomerSearchQuery}
              placeholder="Search by customer name or phone"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />
          </View>

          {searchingCustomers ? (
            <View style={styles.pickerCenter}>
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
                >
                  <Avatar name={c.name} size={42} showBorder />
                  <View style={{ flex: 1, marginLeft: 12 }}>
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

      {/* Unit Selector Modal */}
      <Modal
        visible={activeUnitPickerIdx !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveUnitPickerIdx(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActiveUnitPickerIdx(null)}
        >
          <View style={styles.unitPickerCard}>
            <Text style={styles.unitPickerHeader}>Select Unit</Text>
            {UNITS.map((unit) => (
              <TouchableOpacity
                key={unit}
                style={styles.unitPickerOption}
                onPress={() => {
                  if (activeUnitPickerIdx !== null && medicines[activeUnitPickerIdx]) {
                    updateMedicine(medicines[activeUnitPickerIdx].id, 'unit', unit);
                  }
                  setActiveUnitPickerIdx(null);
                }}
              >
                <Text style={styles.unitPickerOptionText}>{unit}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
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
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
  },
  backButton: {
    width: TOUCH_TARGETS.minWidth,
    height: TOUCH_TARGETS.minHeight,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 40,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  customerMeta: {
    flex: 1,
    marginLeft: 12,
  },
  customerName: {
    ...TYPOGRAPHY.h3,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  customerPhone: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  noCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectCustomerPrompt: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
    fontWeight: '600',
    flex: 1,
  },
  dateSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  dateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  dateValue: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 1,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  medicineCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  inputLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  medicineNameInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 8,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  suggestionChip: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  suggestionChipText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '600',
  },
  qtyPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  qtyCol: {
    flex: 1,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    minWidth: 36,
    textAlign: 'center',
    marginHorizontal: 4,
  },
  unitDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    height: 38,
    marginLeft: 8,
    backgroundColor: COLORS.background,
  },
  unitDropdownText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text,
    marginRight: 4,
  },
  deleteMedBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  priceRowLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginRight: 6,
  },
  priceInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    height: 34,
    width: 80,
    fontSize: 14,
    color: COLORS.text,
  },
  lineTotalText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.primary,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  addMedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: RADIUS.pill,
    height: 48,
    marginBottom: 20,
  },
  addMedBtnText: {
    ...TYPOGRAPHY.button,
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  noteSection: {
    marginBottom: 20,
  },
  noteInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 70,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  totalSummaryCard: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  totalSummaryLabel: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  totalSummaryValue: {
    ...TYPOGRAPHY.h2,
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  paidInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    marginBottom: 10,
  },
  paidLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  paidInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    height: 38,
    minWidth: 110,
  },
  rupeePrefix: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginRight: 4,
    fontWeight: '600',
  },
  paidInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'right',
    paddingVertical: 0,
  },
  paymentPresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  paymentPresetPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  paymentPresetPillActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  paymentPresetPillText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  paymentPresetPillTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  dueSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  dueSummaryLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  dueSummaryValue: {
    ...TYPOGRAPHY.label,
    fontSize: 14,
    fontWeight: '700',
  },
  dueSummaryValueOwed: {
    color: '#D97706',
  },
  dueSummaryValueSettled: {
    color: '#059669',
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pickerSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
  },
  pickerSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 48,
    marginBottom: 12,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  pickerList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 24,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  pickerItemName: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  pickerItemPhone: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  pickerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  unitPickerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    width: '75%',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  unitPickerHeader: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  unitPickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  unitPickerOptionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontSize: 15,
    textTransform: 'capitalize',
  },
});

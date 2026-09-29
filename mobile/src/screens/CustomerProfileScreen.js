import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, TOUCH_TARGETS } from '../constants/theme';
import {
  getCustomerById,
  getCustomerLedger,
  addDuePayment,
  softDeleteCustomer,
  updateCustomer,
} from '../db/database';
import { formatDate } from '../utils/dateUtils';
import Avatar from '../components/Avatar';
import ConfirmationModal from '../components/ConfirmationModal';
import NetworkBanner from '../components/NetworkBanner';

export default function CustomerProfileScreen({ route, navigation }) {
  const { customerId } = route.params;

  const [customer, setCustomer] = useState(route.params?.customer || null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'month' | '3months'
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);

  // Edit Customer Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editVillage, setEditVillage] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Payment Modal State
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const savingPaymentRef = useRef(false);
  const savingEditRef = useRef(false);

  // Delete Confirmation Modal State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const cust = await getCustomerById(customerId);
      const entries = await getCustomerLedger(customerId);
      if (cust) {
        setCustomer(cust);
        setEditName(cust.name || '');
        setEditPhone(cust.phone_number || '');
        setEditVillage(cust.village || '');
        setEditAddress(cust.address || '');
        setEditNotes(cust.notes || '');
      }
      setLedger(entries || []);
    } catch (err) {
      console.warn('Error loading customer profile:', err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleRecordPayment = async () => {
    if (savingPaymentRef.current) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      const msg = 'Please enter a valid payment amount.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Invalid Amount', msg);
      return;
    }

    savingPaymentRef.current = true;
    setSavingPayment(true);
    try {
      await addDuePayment({
        customerId,
        amountPaid: amount,
      });
      setPaymentAmount('');
      setPayModalVisible(false);
      await loadProfile();
      const msg = `Payment of ₹${amount.toFixed(0)} recorded successfully.`;
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Payment Recorded', msg);
    } catch (err) {
      const msg = err.message || 'Could not record payment. Please try again.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Payment Failed', msg);
    } finally {
      savingPaymentRef.current = false;
      setSavingPayment(false);
    }
  };

  const handleSaveCustomer = async () => {
    if (savingEditRef.current) return;
    if (!editName.trim()) {
      const msg = 'Customer name is required.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Validation Error', msg);
      return;
    }

    savingEditRef.current = true;
    setSavingEdit(true);
    try {
      await updateCustomer({
        customerId,
        name: editName.trim(),
        phone: editPhone.trim(),
        village: editVillage.trim(),
        address: editAddress.trim(),
        notes: editNotes.trim(),
      });
      setEditModalVisible(false);
      await loadProfile();
      const msg = 'Customer details updated.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Success', msg);
    } catch (err) {
      const msg = err.message || 'Could not update customer.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Update Failed', msg);
    } finally {
      savingEditRef.current = false;
      setSavingEdit(false);
    }
  };

  const handleDeleteCustomer = async () => {
    setDeleting(true);
    try {
      await softDeleteCustomer(customerId);
      setDeleteModalVisible(false);
      const msg = `${customer?.name || 'Customer'} moved to Recycle Bin.`;
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Customer Deleted', msg);
      navigation.goBack();
    } catch (err) {
      const msg = err.message || 'Could not delete customer.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Delete Failed', msg);
    } finally {
      setDeleting(false);
    }
  };

  // Filter ledger entries
  const filteredLedger = useMemo(() => {
    const now = new Date();
    return ledger.filter((entry) => {
      if (historyFilter === 'all') return true;
      const entryDate = new Date(entry.entry_date);
      if (historyFilter === 'month') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setDate(now.getDate() - 30);
        return entryDate >= oneMonthAgo;
      }
      if (historyFilter === '3months') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setDate(now.getDate() - 90);
        return entryDate >= threeMonthsAgo;
      }
      return true;
    });
  }, [ledger, historyFilter]);

  // Group purchases by formatted date header (e.g. "12 Sep 2026")
  const groupedPurchases = useMemo(() => {
    const groups = {};
    filteredLedger.forEach((entry) => {
      const dateObj = new Date(entry.entry_date);
      const dayKey = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Recent Purchases';
      if (!groups[dayKey]) {
        groups[dayKey] = [];
      }
      groups[dayKey].push(entry);
    });
    return Object.entries(groups).map(([date, entries]) => ({
      date,
      entries,
    }));
  }, [filteredLedger]);

  const totalDue = parseFloat(customer?.total_due || 0);

  const getFilterLabel = () => {
    switch (historyFilter) {
      case 'month':
        return 'Last 30 days';
      case '3months':
        return 'Last 3 months';
      default:
        return 'All purchases';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <NetworkBanner />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="cust-profile-back-btn"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        {/* Filter pill dropdown button on right */}
        <TouchableOpacity
          style={styles.filterPill}
          onPress={() => setFilterMenuVisible(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Filter: ${getFilterLabel()}`}
        >
          <Text style={styles.filterPillText}>{getFilterLabel()}</Text>
          <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading customer records...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Customer Profile Hero Section */}
          <View style={styles.profileSection}>
            <View style={styles.profileRow}>
              <Avatar name={customer?.name || 'Customer'} size={56} showBorder />
              <View style={styles.profileMeta}>
                <Text style={styles.customerName} numberOfLines={1} ellipsizeMode="tail">
                  {customer?.name}
                </Text>
                <Text style={styles.customerPhone}>
                  {customer?.phone_number || 'No phone number'}
                </Text>
              </View>
              {/* More / Edit Actions */}
              <TouchableOpacity
                style={styles.editActionBtn}
                onPress={() => setEditModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Edit Customer Info"
              >
                <Ionicons name="ellipsis-horizontal" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* If due balance exists, subtle due notice */}
            {totalDue > 0 && (
              <View style={styles.dueNoticeRow}>
                <View style={styles.dueNoticeLeft}>
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
                  <Text style={styles.dueNoticeText}>
                    Pending due: <Text style={{ fontWeight: '700' }}>₹{totalDue.toFixed(0)}</Text>
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.duePaySmallBtn}
                  onPress={() => setPayModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.duePaySmallBtnText}>Record Payment</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Prominent "+ Record purchase" Action Button */}
            <TouchableOpacity
              testID="cust-record-purchase-btn"
              style={styles.recordPurchaseBtn}
              onPress={() =>
                navigation.navigate('AddPurchase', {
                  customerId,
                  customer,
                })
              }
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Record purchase for this customer"
            >
              <Ionicons name="add" size={22} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.recordPurchaseBtnText}>Record purchase</Text>
            </TouchableOpacity>
          </View>

          {/* Purchase History Section */}
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Purchase history</Text>

            {groupedPurchases.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={44} color={COLORS.borderStrong} />
                <Text style={styles.emptyTitle}>No purchases recorded</Text>
                <Text style={styles.emptySubtitle}>
                  {historyFilter === 'all'
                    ? 'Start tracking medicine purchases for this customer.'
                    : 'No purchases found for this filter period.'}
                </Text>
              </View>
            ) : (
              groupedPurchases.map((group) => (
                <View key={group.date} style={styles.dateGroup}>
                  <Text style={styles.dateHeader}>{group.date}</Text>

                  {group.entries.map((entry) => {
                    const entryMedicines = entry.medicines || [];
                    const timeStr = entry.entry_date
                      ? new Date(entry.entry_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '';
                    const fullDateStr = entry.entry_date
                      ? `${group.date} · ${timeStr}`
                      : group.date;

                    // If entry has medicines, show each item row
                    if (entryMedicines.length > 0) {
                      return entryMedicines.map((med, medIdx) => {
                        const medPrice = (parseFloat(med.price || med.unit_price || 0) * (med.quantity || 1)).toFixed(0);
                        const quantityText = `${med.quantity || 1} ${med.unit || 'units'}`;

                        return (
                          <TouchableOpacity
                            key={`${entry.entry_id}-${med.id || medIdx}`}
                            style={styles.historyCard}
                            onPress={() =>
                              navigation.navigate('PurchaseDetails', {
                                entryId: entry.entry_id,
                                entry: {
                                  ...entry,
                                  customer_name: customer?.name,
                                  phone_number: customer?.phone_number,
                                },
                              })
                            }
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={`${med.medicine_name}, ${quantityText}, ₹${medPrice}`}
                          >
                            <View style={styles.medIconBadge}>
                              <Ionicons name="medkit" size={16} color={COLORS.primary} />
                            </View>

                            <View style={styles.historyInfo}>
                              <Text style={styles.historyMedName} numberOfLines={1}>
                                {med.medicine_name}
                              </Text>
                              <Text style={styles.historyQty}>{quantityText}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                <Text style={styles.historyTimestamp}>{fullDateStr}</Text>
                                {entry.is_pending && (
                                  <View style={styles.pendingBadge}>
                                    <Ionicons name="time-outline" size={11} color="#B45309" style={{ marginRight: 2 }} />
                                    <Text style={styles.pendingBadgeText}>Pending sync</Text>
                                  </View>
                                )}
                              </View>
                            </View>

                            <View style={styles.historyRight}>
                              <Text style={styles.historyPrice}>₹{medPrice}</Text>
                              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                            </View>
                          </TouchableOpacity>
                        );
                      });
                    }

                    // Fallback for entry with no itemized medicines (e.g. lump sum)
                    const entryTotal = parseFloat(entry.total_amount || 0).toFixed(0);
                    return (
                      <TouchableOpacity
                        key={entry.entry_id}
                        style={styles.historyCard}
                        onPress={() =>
                          navigation.navigate('PurchaseDetails', {
                            entryId: entry.entry_id,
                            entry: {
                              ...entry,
                              customer_name: customer?.name,
                              phone_number: customer?.phone_number,
                            },
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <View style={styles.medIconBadge}>
                          <Ionicons name="receipt" size={16} color={COLORS.primary} />
                        </View>
                        <View style={styles.historyInfo}>
                          <Text style={styles.historyMedName} numberOfLines={1}>
                            Purchase Record
                          </Text>
                          <Text style={styles.historyQty}>Lump sum purchase</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <Text style={styles.historyTimestamp}>{fullDateStr}</Text>
                            {entry.is_pending && (
                              <View style={styles.pendingBadge}>
                                <Ionicons name="time-outline" size={11} color="#B45309" style={{ marginRight: 2 }} />
                                <Text style={styles.pendingBadgeText}>Pending sync</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={styles.historyRight}>
                          <Text style={styles.historyPrice}>₹{entryTotal}</Text>
                          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* Filter Selection Modal */}
      <Modal
        visible={filterMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterMenuVisible(false)}
        >
          <View style={styles.filterMenuBox}>
            <Text style={styles.filterMenuHeader}>Filter Purchases</Text>
            {[
              { id: 'all', label: 'All purchases' },
              { id: 'month', label: 'Last 30 days' },
              { id: '3months', label: 'Last 3 months' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.filterOption,
                  historyFilter === opt.id && styles.filterOptionActive,
                ]}
                onPress={() => {
                  setHistoryFilter(opt.id);
                  setFilterMenuVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    historyFilter === opt.id && styles.filterOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
                {historyFilter === opt.id && (
                  <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContainer}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Customer Details</Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Customer Name"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.modalInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.inputLabel}>Village / Locality</Text>
              <TextInput
                style={styles.modalInput}
                value={editVillage}
                onChangeText={setEditVillage}
                placeholder="Village / Area"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={styles.modalInput}
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Address"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.modalInput, { height: 72, textAlignVertical: 'top' }]}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Any special notes or allergies..."
                multiline
                placeholderTextColor={COLORS.textMuted}
              />

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.deleteCustomerBtn}
                  onPress={() => {
                    setEditModalVisible(false);
                    setDeleteModalVisible(true);
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  <Text style={styles.deleteCustomerBtnText}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveCustomerBtn}
                  onPress={handleSaveCustomer}
                  disabled={savingEdit}
                >
                  {savingEdit ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveCustomerBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        visible={payModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setPayModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.payModalContainer}>
            <Text style={styles.modalTitle}>Record Due Payment</Text>
            <Text style={styles.payModalSubtitle}>
              Current due balance: ₹{totalDue.toFixed(0)}
            </Text>

            <TextInput
              style={styles.payInput}
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              placeholder="Amount (₹)"
              keyboardType="numeric"
              autoFocus
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setPayModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmPayBtn}
                onPress={handleRecordPayment}
                disabled={savingPayment}
              >
                {savingPayment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmPayBtnText}>Save Payment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal for Delete Customer */}
      <ConfirmationModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={handleDeleteCustomer}
        title="Move Customer to Recycle Bin?"
        message="This customer and their records will be stored in the Recycle Bin for 30 days and can be restored at any time."
        confirmText="Move to Bin"
        cancelText="Cancel"
        isDestructive={true}
        iconName="trash"
        confirmLoading={deleting}
      />
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
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPillText: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.text,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 40,
  },
  profileSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileMeta: {
    flex: 1,
    marginLeft: 14,
  },
  customerName: {
    ...TYPOGRAPHY.h2,
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  customerPhone: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  editActionBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  dueNoticeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueNoticeText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.error,
    marginLeft: 6,
  },
  duePaySmallBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  duePaySmallBtnText: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.error,
    fontWeight: '700',
  },
  recordPurchaseBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  recordPurchaseBtnText: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  historySection: {
    marginTop: 8,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 14,
  },
  dateGroup: {
    marginBottom: 20,
  },
  dateHeader: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  historyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  medIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.avatarBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyMedName: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  historyQty: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  historyTimestamp: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontSize: 12,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.pill,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingBadgeText: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '700',
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  historyPrice: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginRight: 6,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  emptyContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginTop: 12,
    fontWeight: '700',
  },
  emptySubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  filterMenuBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    width: '80%',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  filterMenuHeader: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
  },
  filterOptionActive: {
    backgroundColor: COLORS.surfaceSubtle,
  },
  filterOptionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  filterOptionTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  editModalContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 20,
    width: '94%',
    maxHeight: '85%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  inputLabel: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 14,
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 12,
  },
  deleteCustomerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  deleteCustomerBtnText: {
    ...TYPOGRAPHY.label,
    color: COLORS.error,
    fontWeight: '700',
    marginLeft: 6,
  },
  saveCustomerBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCustomerBtnText: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  payModalContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 20,
    width: '88%',
  },
  payModalSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.error,
    marginVertical: 10,
    fontWeight: '600',
  },
  payInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    height: 52,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 20,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  confirmPayBtn: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPayBtnText: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

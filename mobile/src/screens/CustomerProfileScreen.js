import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
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
import StatCard from '../components/StatCard';
import FilterPills from '../components/FilterPills';
import ConfirmationModal from '../components/ConfirmationModal';
import NetworkBanner from '../components/NetworkBanner';

export default function CustomerProfileScreen({ route, navigation }) {
  const { customerId } = route.params;

  const [customer, setCustomer] = useState(route.params?.customer || null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'notes' | 'details'
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'month' | '3months'

  // Payment Modal State
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Edit Customer Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

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
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      const msg = 'Please enter a valid payment amount.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Invalid Amount', msg);
      return;
    }

    setSavingPayment(true);
    try {
      await addDuePayment({
        customerId,
        amountPaid: amount,
      });
      setPaymentAmount('');
      setPayModalVisible(false);
      await loadProfile();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not record payment');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleSaveCustomerEdits = async () => {
    if (!editName.trim()) {
      const msg = 'Customer name cannot be empty.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Required', msg);
      return;
    }

    setSavingEdit(true);
    try {
      await updateCustomer(customerId, {
        name: editName.trim(),
        phone_number: editPhone.trim(),
        address: editAddress.trim(),
        notes: editNotes.trim(),
      });
      setEditModalVisible(false);
      await loadProfile();
    } catch (e) {
      Alert.alert('Save Failed', e.message || 'Could not update customer');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteCustomer = async () => {
    setDeleting(true);
    try {
      await softDeleteCustomer(customerId);
      setDeleteModalVisible(false);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Delete Failed', err.message || 'Could not delete customer');
    } finally {
      setDeleting(false);
    }
  };

  // Filter purchases according to search and time range
  const filteredLedger = ledger.filter((entry) => {
    // Search query matching medicines or notes
    if (purchaseSearch.trim().length > 0) {
      const query = purchaseSearch.toLowerCase();
      const hasMed = (entry.medicines || []).some((m) =>
        (m.medicine_name || '').toLowerCase().includes(query)
      );
      const hasNote = (entry.notes || '').toLowerCase().includes(query);
      if (!hasMed && !hasNote) return false;
    }

    if (historyFilter === 'month') {
      const entryTime = new Date(entry.entry_date || 0).getTime();
      const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      return entryTime >= oneMonthAgo;
    } else if (historyFilter === '3months') {
      const entryTime = new Date(entry.entry_date || 0).getTime();
      const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      return entryTime >= threeMonthsAgo;
    }

    return true;
  });

  // Calculate metrics
  const totalPurchases = ledger.length;
  const totalSpent = ledger.reduce(
    (sum, e) => sum + parseFloat(e.total_amount || 0),
    0
  );
  const totalDue = parseFloat(customer?.total_due || 0);
  const lastPurchaseDate = ledger.length > 0 ? ledger[0].entry_date : null;

  const historyFilterOptions = [
    { key: 'all', label: 'All', count: ledger.length },
    { key: 'month', label: 'This Month' },
    { key: '3months', label: 'Last 3 Months' },
  ];

  const renderPurchaseItem = ({ item }) => {
    const medicines = item.medicines || [];
    const dateFormatted = formatDate(item.entry_date);
    const amount = parseFloat(item.total_amount || 0);

    return (
      <TouchableOpacity
        style={styles.purchaseCard}
        onPress={() =>
          navigation.navigate('PurchaseDetails', {
            entryId: item.entry_id,
            entry: {
              ...item,
              customer_name: customer?.name,
              phone_number: customer?.phone_number,
              customer_id: customerId,
            },
          })
        }
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Purchase on ${dateFormatted}, total ₹${amount.toFixed(0)}`}
      >
        <View style={styles.purchaseCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.purchaseDate}>{dateFormatted}</Text>
            <Text style={styles.purchaseItemCount}>
              {medicines.length} {medicines.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
          <Text style={styles.purchaseTotal}>₹{amount.toFixed(0)}</Text>
        </View>

        {/* Medicine line items breakdown */}
        {medicines.length > 0 && (
          <View style={styles.medBreakdownList}>
            {medicines.map((m, idx) => (
              <View key={m.id || idx} style={styles.medLineItem}>
                <View style={styles.medLineLeft}>
                  <Ionicons name="medkit-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.medLineName} numberOfLines={1}>
                    {m.medicine_name}
                  </Text>
                </View>
                <Text style={styles.medLineQty}>
                  {m.quantity || 1} × ₹{parseFloat(m.unit_price || m.price || 0).toFixed(0)}
                </Text>
                <Text style={styles.medLinePrice}>
                  ₹{(parseFloat(m.unit_price || m.price || 0) * (m.quantity || 1)).toFixed(0)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.purchaseCardFooter}>
          <Text style={styles.viewDetailsText}>View Purchase Details</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <NetworkBanner />

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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {customer?.name || 'Customer Profile'}
        </Text>
        <TouchableOpacity
          style={styles.editHeaderBtn}
          onPress={() => setEditModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Edit Customer"
        >
          <Ionicons name="create-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading customer records...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Fixed Customer Meta Profile */}
          <View style={styles.customerHeaderCard}>
            <View style={styles.profileRow}>
              <Avatar name={customer?.name || 'Customer'} size={56} />
              <View style={styles.profileMeta}>
                <Text style={styles.profileName}>{customer?.name}</Text>
                <Text style={styles.profilePhone}>{customer?.phone_number || 'No phone number'}</Text>
                <Text style={styles.customerSince}>
                  Customer since {customer?.created_at ? formatDate(customer.created_at) : 'Jan 2024'}
                </Text>
              </View>
            </View>

            {/* 4 Stat Cards in a row (Purchases, Total Spent, Due Amount, Last Purchase) */}
            <View style={styles.statsRow}>
              <StatCard
                label="Purchases"
                value={totalPurchases}
                style={styles.statItem}
              />
              <StatCard
                label="Total Spent"
                value={`₹${totalSpent.toFixed(0)}`}
                style={styles.statItem}
              />
              <StatCard
                label="Due Amount"
                value={`₹${totalDue.toFixed(0)}`}
                highlightColor={totalDue > 0 ? COLORS.error : COLORS.text}
                style={styles.statItem}
              />
              <StatCard
                label="Last Purchase"
                value={lastPurchaseDate ? formatDate(lastPurchaseDate).split(' ')[0] : 'None'}
                style={styles.statItem}
              />
            </View>

            {/* Unpaid Balance Action Banner if dues exist */}
            {totalDue > 0 && (
              <View style={styles.dueAlertBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dueAlertTitle}>Unpaid Due Balance</Text>
                  <Text style={styles.dueAlertAmount}>₹{totalDue.toFixed(2)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.recordPayBtn}
                  onPress={() => setPayModalVisible(true)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Record Payment"
                >
                  <Text style={styles.recordPayBtnText}>Record Payment</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Tab navigation pills: Purchase History | Notes | Details */}
            <View style={styles.subTabRow}>
              <TouchableOpacity
                style={[styles.subTab, activeTab === 'history' && styles.subTabActive]}
                onPress={() => setActiveTab('history')}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'history' }}
              >
                <Text
                  style={[
                    styles.subTabText,
                    activeTab === 'history' && styles.subTabTextActive,
                  ]}
                >
                  Purchase History
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.subTab, activeTab === 'notes' && styles.subTabActive]}
                onPress={() => setActiveTab('notes')}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'notes' }}
              >
                <Text
                  style={[
                    styles.subTabText,
                    activeTab === 'notes' && styles.subTabTextActive,
                  ]}
                >
                  Notes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.subTab, activeTab === 'details' && styles.subTabActive]}
                onPress={() => setActiveTab('details')}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'details' }}
              >
                <Text
                  style={[
                    styles.subTabText,
                    activeTab === 'details' && styles.subTabTextActive,
                  ]}
                >
                  Details
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tab Content */}
          {activeTab === 'history' ? (
            <View style={{ flex: 1 }}>
              {/* Search Inside Customer Purchases */}
              <View style={styles.searchWrap}>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={18} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search in this customer's purchases..."
                    placeholderTextColor={COLORS.textMuted}
                    value={purchaseSearch}
                    onChangeText={setPurchaseSearch}
                    clearButtonMode="while-editing"
                  />
                </View>
              </View>

              {/* Date Filters: All | This Month | Last 3 Months */}
              <View style={styles.filterWrap}>
                <FilterPills
                  options={historyFilterOptions}
                  selected={historyFilter}
                  onSelect={setHistoryFilter}
                />
              </View>

              {filteredLedger.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="receipt-outline" size={44} color={COLORS.textMuted} />
                  <Text style={styles.emptyTitle}>No Purchases Found</Text>
                  <Text style={styles.emptySubtitle}>
                    {purchaseSearch
                      ? `No purchases matched "${purchaseSearch}".`
                      : 'No purchase records recorded yet for this customer.'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredLedger}
                  keyExtractor={(item) => String(item.entry_id)}
                  renderItem={renderPurchaseItem}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          ) : activeTab === 'notes' ? (
            <View style={styles.tabContentContainer}>
              <View style={styles.cardBox}>
                <Text style={styles.cardBoxTitle}>Customer Notes</Text>
                <Text style={styles.cardBoxText}>
                  {customer?.notes || 'No customer notes recorded yet.'}
                </Text>
                <TouchableOpacity
                  style={styles.editNotesBtn}
                  onPress={() => setEditModalVisible(true)}
                >
                  <Ionicons name="pencil" size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.editNotesBtnText}>Edit Notes</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.tabContentContainer}>
              <View style={styles.cardBox}>
                <Text style={styles.cardBoxTitle}>Customer Details</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Full Name</Text>
                  <Text style={styles.detailValue}>{customer?.name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Phone Number</Text>
                  <Text style={styles.detailValue}>{customer?.phone_number || 'None'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Address</Text>
                  <Text style={styles.detailValue}>{customer?.address || 'None'}</Text>
                </View>

                <TouchableOpacity
                  style={styles.deleteCustBtn}
                  onPress={() => setDeleteModalVisible(true)}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} style={{ marginRight: 6 }} />
                  <Text style={styles.deleteCustBtnText}>Move to Recycle Bin</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Sticky Bottom Action: + New Purchase */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.newPurchaseBtn}
              onPress={() =>
                navigation.navigate('AddPurchase', {
                  customerId,
                  customer,
                })
              }
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`New Purchase for ${customer?.name}`}
            >
              <Ionicons name="add" size={24} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.newPurchaseBtnText}>
                + New Purchase for {customer?.name || 'Customer'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Record Payment Modal */}
      <Modal
        visible={payModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPayModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Record Customer Payment</Text>
            <Text style={styles.modalSubtitle}>
              Current Due: ₹{totalDue.toFixed(2)}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Enter amount paid (₹)"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPayModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleRecordPayment}
                disabled={savingPayment}
              >
                {savingPayment ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Save Payment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Customer Details</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Full Name *"
              value={editName}
              onChangeText={setEditName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Phone Number"
              keyboardType="phone-pad"
              value={editPhone}
              onChangeText={setEditPhone}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Address (Optional)"
              value={editAddress}
              onChangeText={setEditAddress}
            />
            <TextInput
              style={[styles.modalInput, { minHeight: 60 }]}
              placeholder="Notes (Optional)"
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleSaveCustomerEdits}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Move to Recycle Bin Confirmation */}
      <ConfirmationModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={handleDeleteCustomer}
        title={`Delete ${customer?.name}?`}
        message="This customer and their records will be moved to the Recycle Bin. You can restore them anytime within 30 days."
        confirmText="Move to Bin"
        cancelText="Keep Customer"
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
    flex: 1,
    marginHorizontal: SPACING.sm,
  },
  editHeaderBtn: {
    width: TOUCH_TARGETS.minWidth,
    height: TOUCH_TARGETS.minHeight,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  customerHeaderCard: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  profileMeta: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  profileName: {
    ...TYPOGRAPHY.h2,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  profilePhone: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    marginVertical: 2,
  },
  customerSince: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  statItem: {
    flex: 1,
    paddingHorizontal: 4,
  },
  dueAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECE7',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#F8B4A2',
  },
  dueAlertTitle: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.error,
  },
  dueAlertAmount: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.error,
  },
  recordPayBtn: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    minHeight: 36,
    justifyContent: 'center',
  },
  recordPayBtnText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subTabRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  subTab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    minHeight: TOUCH_TARGETS.minHeight,
    justifyContent: 'center',
  },
  subTabActive: {
    borderBottomColor: COLORS.primary,
  },
  subTabText: {
    ...TYPOGRAPHY.label,
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  subTabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  searchWrap: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.text,
  },
  filterWrap: {
    backgroundColor: COLORS.surface,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 80,
  },
  purchaseCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  purchaseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  purchaseDate: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  purchaseItemCount: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  purchaseTotal: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  medBreakdownList: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginVertical: SPACING.xs,
  },
  medLineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  medLineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  medLineName: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginLeft: 6,
    flex: 1,
  },
  medLineQty: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginHorizontal: 8,
  },
  medLinePrice: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  purchaseCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: SPACING.xs,
  },
  viewDetailsText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    marginRight: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  newPurchaseBtn: {
    minHeight: TOUCH_TARGETS.minHeight,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  newPurchaseBtnText: {
    ...TYPOGRAPHY.label,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabContentContainer: {
    padding: SPACING.md,
  },
  cardBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardBoxTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  cardBoxText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  editNotesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
  },
  editNotesBtnText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
  },
  detailRow: {
    marginBottom: SPACING.md,
  },
  detailLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  deleteCustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECE7',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: '#F8B4A2',
    minHeight: TOUCH_TARGETS.minHeight,
  },
  deleteCustBtnText: {
    ...TYPOGRAPHY.label,
    fontSize: 15,
    color: COLORS.error,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptyContainer: {
    padding: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
  },
  modalTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    minHeight: TOUCH_TARGETS.minHeight,
    ...TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  modalCancelBtn: {
    flex: 1,
    minHeight: TOUCH_TARGETS.minHeight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    ...TYPOGRAPHY.label,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  modalConfirmBtn: {
    flex: 1,
    minHeight: TOUCH_TARGETS.minHeight,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmText: {
    ...TYPOGRAPHY.label,
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

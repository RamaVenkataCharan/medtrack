import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, TOUCH_TARGETS } from '../constants/theme';
import {
  getDeletedCustomers,
  restoreCustomer,
  permanentDeleteCustomer,
  getDeletedPurchases,
  restorePurchase,
  permanentDeletePurchase,
} from '../db/database';
import { formatDate } from '../utils/dateUtils';
import Avatar from '../components/Avatar';
import ConfirmationModal from '../components/ConfirmationModal';

export default function RecycleBinScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('customers'); // 'customers' | 'purchases'
  const [deletedCustomers, setDeletedCustomers] = useState([]);
  const [deletedPurchases, setDeletedPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Restore Modal State (Screen 11)
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [targetItem, setTargetItem] = useState(null);
  const [restoring, setRestoring] = useState(false);

  // Restored Successfully State (Screen 12)
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [restoredCustomerData, setRestoredCustomerData] = useState(null);

  // Permanent Delete Modal State
  const [permDeleteModalVisible, setPermDeleteModalVisible] = useState(false);
  const [deletingPermanent, setDeletingPermanent] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [custList, purList] = await Promise.all([
        getDeletedCustomers().catch(() => []),
        getDeletedPurchases().catch(() => []),
      ]);
      setDeletedCustomers(custList || []);
      setDeletedPurchases(purList || []);
    } catch (err) {
      console.warn('Error loading recycle bin:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const calculateDaysLeft = (deletedAt) => {
    if (!deletedAt) return 30;
    const deletedTime = new Date(deletedAt).getTime();
    const elapsedDays = Math.floor((Date.now() - deletedTime) / (1000 * 60 * 60 * 24));
    return Math.max(1, 30 - elapsedDays);
  };

  const handleOpenRestoreConfirm = (item) => {
    setTargetItem(item);
    setRestoreModalVisible(true);
  };

  const handleOpenPermDeleteConfirm = (item) => {
    setTargetItem(item);
    setPermDeleteModalVisible(true);
  };

  const executeRestore = async () => {
    if (!targetItem) return;
    setRestoring(true);
    try {
      if (activeTab === 'customers') {
        await restoreCustomer(targetItem.customer_id);
        setRestoredCustomerData(targetItem);
        setRestoreModalVisible(false);
        setSuccessModalVisible(true);
      } else {
        await restorePurchase(targetItem.entry_id);
        setRestoreModalVisible(false);
        if (Platform.OS === 'web') alert('Purchase record restored successfully.');
        else Alert.alert('Restored', 'Purchase restored successfully.');
      }
      await loadData();
    } catch (err) {
      Alert.alert('Restore Failed', err.message || 'Could not restore record');
    } finally {
      setRestoring(false);
    }
  };

  const executePermanentDelete = async () => {
    if (!targetItem) return;
    setDeletingPermanent(true);
    try {
      if (activeTab === 'customers') {
        await permanentDeleteCustomer(targetItem.customer_id);
      } else {
        await permanentDeletePurchase(targetItem.entry_id);
      }
      setPermDeleteModalVisible(false);
      await loadData();
    } catch (err) {
      Alert.alert('Delete Failed', err.message || 'Could not permanently delete record');
    } finally {
      setDeletingPermanent(false);
    }
  };

  const renderCustomerItem = ({ item }) => {
    const daysLeft = calculateDaysLeft(item.deleted_at);
    const deletedDateStr = item.deleted_at ? formatDate(item.deleted_at) : 'Recently';

    return (
      <View testID={`recycle-cust-card-${item.customer_id}`} style={styles.card}>
        <View style={styles.cardHeader}>
          <Avatar name={item.name} size={40} />
          <View style={styles.customerMeta}>
            <Text style={styles.customerName} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>
              {item.name}
            </Text>
            <Text style={styles.customerPhone} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>
              {item.phone_number || 'No phone'}
            </Text>
            <Text style={styles.deletedDate} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>
              Deleted {deletedDateStr}
            </Text>
          </View>
          <View style={styles.daysBadge}>
            <Text style={styles.daysText} maxFontSizeMultiplier={1.3}>{daysLeft} days left</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            testID={`recycle-cust-restore-${item.customer_id}`}
            style={styles.restoreBtn}
            onPress={() => handleOpenRestoreConfirm(item)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Restore ${item.name}`}
          >
            <Ionicons name="refresh" size={15} color={COLORS.primary} style={{ marginRight: 4 }} />
            <Text style={styles.restoreBtnText} maxFontSizeMultiplier={1.3}>Restore</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID={`recycle-cust-delete-${item.customer_id}`}
            style={styles.permDeleteBtn}
            onPress={() => handleOpenPermDeleteConfirm(item)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Permanently delete ${item.name}`}
          >
            <Ionicons name="trash-bin" size={15} color={COLORS.error} style={{ marginRight: 4 }} />
            <Text style={styles.permDeleteBtnText} maxFontSizeMultiplier={1.3}>Delete Permanently</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPurchaseItem = ({ item }) => {
    const daysLeft = calculateDaysLeft(item.deleted_at);
    const deletedDateStr = item.deleted_at ? formatDate(item.deleted_at) : 'Recently';
    const amount = parseFloat(item.total_amount || 0);
    const meds = item.medicines || [];

    return (
      <View testID={`recycle-pur-card-${item.entry_id}`} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.purchaseIconBox}>
            <Ionicons name="receipt" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.customerMeta}>
            <Text style={styles.customerName} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>
              {item.customer_name || 'Customer'}
            </Text>
            <Text style={styles.customerPhone} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>
              {meds.length} medicines • ₹{amount.toFixed(0)}
            </Text>
            <Text style={styles.deletedDate} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>
              Deleted {deletedDateStr}
            </Text>
          </View>
          <View style={styles.daysBadge}>
            <Text style={styles.daysText} maxFontSizeMultiplier={1.3}>{daysLeft} days left</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            testID={`recycle-pur-restore-${item.entry_id}`}
            style={styles.restoreBtn}
            onPress={() => handleOpenRestoreConfirm(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={15} color={COLORS.primary} style={{ marginRight: 4 }} />
            <Text style={styles.restoreBtnText} maxFontSizeMultiplier={1.3}>Restore</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID={`recycle-pur-delete-${item.entry_id}`}
            style={styles.permDeleteBtn}
            onPress={() => handleOpenPermDeleteConfirm(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-bin" size={15} color={COLORS.error} style={{ marginRight: 4 }} />
            <Text style={styles.permDeleteBtnText} maxFontSizeMultiplier={1.3}>Delete Permanently</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          testID="recycle-back-btn"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Recycle Bin</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 2-Tab Navigation: Customers (N) | Purchases (N) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          testID="recycle-tab-customers"
          style={[styles.tabItem, activeTab === 'customers' && styles.tabItemActive]}
          onPress={() => setActiveTab('customers')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'customers' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'customers' && styles.tabTextActive,
            ]}
            maxFontSizeMultiplier={1.3}
          >
            Customers ({deletedCustomers.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="recycle-tab-purchases"
          style={[styles.tabItem, activeTab === 'purchases' && styles.tabItemActive]}
          onPress={() => setActiveTab('purchases')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'purchases' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'purchases' && styles.tabTextActive,
            ]}
            maxFontSizeMultiplier={1.3}
          >
            Purchases ({deletedPurchases.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Information Banner */}
      <View style={styles.noticeBanner}>
        <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
        <Text style={styles.noticeText} maxFontSizeMultiplier={1.3}>
          Deleted records are kept safely for 30 days. You can restore them anytime.
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText} maxFontSizeMultiplier={1.3}>Checking recycle bin...</Text>
        </View>
      ) : activeTab === 'customers' ? (
        deletedCustomers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="trash-bin-outline" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.3}>Recycle Bin Empty</Text>
            <Text style={styles.emptySubtitle} maxFontSizeMultiplier={1.3}>No deleted customer records found.</Text>
          </View>
        ) : (
          <FlatList
            data={deletedCustomers}
            keyExtractor={(item) => String(item.customer_id)}
            renderItem={renderCustomerItem}
            contentContainerStyle={styles.listContent}
          />
        )
      ) : deletedPurchases.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={40} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.3}>No Deleted Purchases</Text>
          <Text style={styles.emptySubtitle} maxFontSizeMultiplier={1.3}>No deleted purchase records found.</Text>
        </View>
      ) : (
        <FlatList
          data={deletedPurchases}
          keyExtractor={(item) => String(item.entry_id)}
          renderItem={renderPurchaseItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Screen 11: Restore Confirmation Modal */}
      <ConfirmationModal
        visible={restoreModalVisible}
        onClose={() => setRestoreModalVisible(false)}
        onConfirm={executeRestore}
        title={
          activeTab === 'customers'
            ? `Restore ${targetItem?.name}?`
            : `Restore Purchase for ${targetItem?.customer_name}?`
        }
        message="This record will be safely restored back to active customer records with zero data loss."
        checklist={
          activeTab === 'customers'
            ? [
                'Customer contact details & phone number',
                `All past purchase history (${targetItem?.total_entries || 0} records)`,
                'Recorded notes and dues',
              ]
            : ['Original purchase items and rates', 'Recorded total and payment status']
        }
        confirmText="Restore Record"
        cancelText="Cancel"
        isDestructive={false}
        iconName="refresh"
        confirmLoading={restoring}
      />

      {/* Screen 12: Restored Successfully Modal */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successOuterGlow}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={36} color="#FFFFFF" />
              </View>
            </View>

            <Text style={styles.successTitle} maxFontSizeMultiplier={1.3}>Customer Restored Successfully!</Text>
            <Text style={styles.successSubtitle} maxFontSizeMultiplier={1.3}>
              <Text style={{ fontWeight: '700', color: COLORS.text }}>
                {restoredCustomerData?.name}
              </Text>{' '}
              has been restored with all their information and purchase history.
            </Text>

            <View style={styles.successActions}>
              <TouchableOpacity
                testID="recycle-success-view-btn"
                style={styles.successPrimaryBtn}
                onPress={() => {
                  setSuccessModalVisible(false);
                  navigation.navigate('CustomerProfile', {
                    customerId: restoredCustomerData?.customer_id,
                  });
                }}
              >
                <Text style={styles.successPrimaryText} maxFontSizeMultiplier={1.3}>View Customer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="recycle-success-add-purchase-btn"
                style={styles.successSecondaryBtn}
                onPress={() => {
                  setSuccessModalVisible(false);
                  navigation.navigate('AddPurchase', {
                    customerId: restoredCustomerData?.customer_id,
                    customer: restoredCustomerData,
                  });
                }}
              >
                <Text style={styles.successSecondaryText} maxFontSizeMultiplier={1.3}>+ Add New Purchase</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Permanent Deletion Confirmation Modal */}
      <ConfirmationModal
        visible={permDeleteModalVisible}
        onClose={() => setPermDeleteModalVisible(false)}
        onConfirm={executePermanentDelete}
        title="Delete Permanently?"
        message="⚠️ This action CANNOT be undone. The record and its entire history will be permanently erased."
        confirmText="Permanently Erase"
        cancelText="Keep in Bin"
        isDestructive={true}
        iconName="trash"
        confirmLoading={deletingPermanent}
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 18,
    color: COLORS.text,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabItem: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    ...TYPOGRAPHY.label,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#F8B4A2',
  },
  noticeText: {
    flex: 1,
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  purchaseIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerMeta: {
    flex: 1,
    marginLeft: 8,
  },
  customerName: {
    ...TYPOGRAPHY.label,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  customerPhone: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  deletedDate: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  daysBadge: {
    backgroundColor: '#FDECE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#F8B4A2',
  },
  daysText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.error,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  restoreBtn: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  restoreBtnText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },
  permDeleteBtn: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#FEB2B2',
  },
  permDeleteBtnText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 12,
    color: COLORS.error,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
  },
  emptySubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  successCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  successOuterGlow: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 3,
    borderColor: '#F8B4A2',
  },
  successIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  successSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  successActions: {
    width: '100%',
    gap: 8,
  },
  successPrimaryBtn: {
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successPrimaryText: {
    ...TYPOGRAPHY.label,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successSecondaryBtn: {
    height: 48,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successSecondaryText: {
    ...TYPOGRAPHY.label,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});

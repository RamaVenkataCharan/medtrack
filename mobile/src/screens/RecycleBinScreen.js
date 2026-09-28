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
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Avatar name={item.name} size={46} />
          <View style={styles.customerMeta}>
            <Text style={styles.customerName}>{item.name}</Text>
            <Text style={styles.customerPhone}>{item.phone_number || 'No phone'}</Text>
            <Text style={styles.deletedDate}>Deleted {deletedDateStr}</Text>
          </View>
          <View style={styles.daysBadge}>
            <Text style={styles.daysText}>{daysLeft} days left</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={() => handleOpenRestoreConfirm(item)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Restore ${item.name}`}
          >
            <Ionicons name="refresh" size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
            <Text style={styles.restoreBtnText}>Restore</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.permDeleteBtn}
            onPress={() => handleOpenPermDeleteConfirm(item)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Permanently delete ${item.name}`}
          >
            <Ionicons name="trash-bin" size={16} color={COLORS.error} style={{ marginRight: 4 }} />
            <Text style={styles.permDeleteBtnText}>Delete Permanently</Text>
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
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.purchaseIconBox}>
            <Ionicons name="receipt" size={22} color={COLORS.primary} />
          </View>
          <View style={styles.customerMeta}>
            <Text style={styles.customerName}>{item.customer_name || 'Customer'}</Text>
            <Text style={styles.customerPhone}>
              {meds.length} medicines • ₹{amount.toFixed(0)}
            </Text>
            <Text style={styles.deletedDate}>Deleted {deletedDateStr}</Text>
          </View>
          <View style={styles.daysBadge}>
            <Text style={styles.daysText}>{daysLeft} days left</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={() => handleOpenRestoreConfirm(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
            <Text style={styles.restoreBtnText}>Restore</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.permDeleteBtn}
            onPress={() => handleOpenPermDeleteConfirm(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-bin" size={16} color={COLORS.error} style={{ marginRight: 4 }} />
            <Text style={styles.permDeleteBtnText}>Delete Permanently</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recycle Bin</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* 2-Tab Navigation: Customers (N) | Purchases (N) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
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
          >
            Customers ({deletedCustomers.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
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
          >
            Purchases ({deletedPurchases.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Information Banner (Screen 10 in roadmap) */}
      <View style={styles.noticeBanner}>
        <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
        <Text style={styles.noticeText}>
          Deleted records are kept safely for 30 days. You can restore them anytime.
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Checking recycle bin...</Text>
        </View>
      ) : activeTab === 'customers' ? (
        deletedCustomers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="trash-bin-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Recycle Bin Empty</Text>
            <Text style={styles.emptySubtitle}>No deleted customer records found.</Text>
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
          <Ionicons name="receipt-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No Deleted Purchases</Text>
          <Text style={styles.emptySubtitle}>No deleted purchase records found.</Text>
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
                <Ionicons name="checkmark" size={44} color="#FFFFFF" />
              </View>
            </View>

            <Text style={styles.successTitle}>Customer Restored Successfully!</Text>
            <Text style={styles.successSubtitle}>
              <Text style={{ fontWeight: '700', color: COLORS.text }}>
                {restoredCustomerData?.name}
              </Text>{' '}
              has been restored with all their information and purchase history.
            </Text>

            <View style={styles.successActions}>
              <TouchableOpacity
                style={styles.successPrimaryBtn}
                onPress={() => {
                  setSuccessModalVisible(false);
                  navigation.navigate('CustomerProfile', {
                    customerId: restoredCustomerData?.customer_id,
                  });
                }}
              >
                <Text style={styles.successPrimaryText}>View Customer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.successSecondaryBtn}
                onPress={() => {
                  setSuccessModalVisible(false);
                  navigation.navigate('AddPurchase', {
                    customerId: restoredCustomerData?.customer_id,
                    customer: restoredCustomerData,
                  });
                }}
              >
                <Text style={styles.successSecondaryText}>+ Add New Purchase</Text>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGETS.minHeight,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    ...TYPOGRAPHY.label,
    fontSize: 15,
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#F8B4A2',
  },
  noticeText: {
    flex: 1,
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  purchaseIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerMeta: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  customerName: {
    ...TYPOGRAPHY.label,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  customerPhone: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  deletedDate: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  daysBadge: {
    backgroundColor: '#FDECE7',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#F8B4A2',
  },
  daysText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.error,
  },
  cardActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  restoreBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
    minHeight: 40,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  restoreBtnText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
  },
  permDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    minHeight: 40,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#FEB2B2',
  },
  permDeleteBtnText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 13,
    color: COLORS.error,
    fontWeight: '600',
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
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
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  successCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  successOuterGlow: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 4,
    borderColor: '#F8B4A2',
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  successSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  successActions: {
    width: '100%',
    gap: SPACING.sm,
  },
  successPrimaryBtn: {
    minHeight: TOUCH_TARGETS.minHeight,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successPrimaryText: {
    ...TYPOGRAPHY.label,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successSecondaryBtn: {
    minHeight: TOUCH_TARGETS.minHeight,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successSecondaryText: {
    ...TYPOGRAPHY.label,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, TOUCH_TARGETS } from '../constants/theme';
import { getPurchaseDetails, softDeletePurchase } from '../db/database';
import Avatar from '../components/Avatar';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatDate } from '../utils/dateUtils';

export default function PurchaseDetailsScreen({ navigation, route }) {
  const { entryId, entry: initialEntry } = route.params || {};
  const [entry, setEntry] = useState(initialEntry || null);
  const [loading, setLoading] = useState(!initialEntry);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchDetails() {
      if (!entryId) return;
      setLoading(true);
      try {
        const details = await getPurchaseDetails(entryId);
        if (details) {
          setEntry((prev) => ({ ...prev, ...details }));
        }
      } catch (err) {
        console.warn('Failed to load purchase details:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [entryId]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await softDeletePurchase(entryId || entry?.entry_id);
      setShowDeleteModal(false);
      const msg = 'Purchase record moved to Recycle Bin.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Deleted', msg);
      navigation.goBack();
    } catch (err) {
      const msg = err.message || 'Could not delete purchase';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleEditEntry = () => {
    navigation.navigate('AddPurchase', {
      customerId: entry?.customer_id,
      customer: {
        customer_id: entry?.customer_id,
        name: customerName,
        phone_number: customerPhone,
      },
      editEntry: entry,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading purchase details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Purchase details</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Purchase record not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const customerName =
    entry.customer_name ||
    entry.customers?.name ||
    'Customer';
  const customerPhone =
    entry.phone_number ||
    entry.customers?.phone_number ||
    '';

  const medicines = entry.medicines || entry.entry_medicines || entry.items || [];
  const total = parseFloat(entry.total_amount || 0);

  // Format date & time: "12 Sep 2026 · 10:24 AM"
  const dateObj = entry.entry_date ? new Date(entry.entry_date) : new Date();
  const dateStr = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Recent';
  const timeStr = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const dateTimeFormatted = timeStr ? `${dateStr} · ${timeStr}` : dateStr;

  const recordedBy = entry.created_by_name || entry.staff_name || 'Staff';

  return (
    <SafeAreaView style={styles.safeArea}>
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
        <Text style={styles.headerTitle}>Purchase details</Text>
        <TouchableOpacity
          style={styles.deleteHeaderBtn}
          onPress={() => setShowDeleteModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Delete purchase"
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Customer Profile Row */}
        <TouchableOpacity
          style={styles.customerRow}
          onPress={() => {
            if (entry.customer_id) {
              navigation.navigate('CustomerProfile', {
                customerId: entry.customer_id,
                customer: {
                  customer_id: entry.customer_id,
                  name: customerName,
                  phone_number: customerPhone,
                },
              });
            }
          }}
          activeOpacity={0.7}
        >
          <Avatar name={customerName} size={48} showBorder />
          <View style={styles.customerMeta}>
            <Text style={styles.customerName} numberOfLines={1}>
              {customerName}
            </Text>
            {customerPhone ? (
              <Text style={styles.customerPhone}>{customerPhone}</Text>
            ) : null}
          </View>
        </TouchableOpacity>

        {/* Date Row */}
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
          <Text style={styles.dateText}>{dateTimeFormatted}</Text>
        </View>

        {/* Items Card */}
        <View style={styles.itemsCard}>
          <Text style={styles.itemsHeader}>Items</Text>

          {medicines.length === 0 ? (
            <View style={styles.singleItemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>General Purchase</Text>
                <Text style={styles.itemQty}>1 lump sum</Text>
              </View>
              <Text style={styles.itemPrice}>₹{total.toFixed(0)}</Text>
            </View>
          ) : (
            medicines.map((item, idx) => {
              const unitPrice = parseFloat(item.unit_price || item.price || 0);
              const qty = item.quantity || 1;
              const lineTotal = (unitPrice > 0 ? unitPrice * qty : parseFloat(item.price || 0)) || 0;
              const unit = item.unit || 'units';

              return (
                <View key={item.id || idx} style={styles.itemRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.itemName}>{item.medicine_name || item.name}</Text>
                    <Text style={styles.itemQty}>{qty} {unit}</Text>
                  </View>
                  <Text style={styles.itemPrice}>₹{lineTotal > 0 ? lineTotal.toFixed(0) : '—'}</Text>
                </View>
              );
            })
          )}

          {/* Divider line */}
          <View style={styles.cardDivider} />

          {/* Total Row */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <View style={styles.totalBadge}>
              <Text style={styles.totalValue}>₹{total.toFixed(0)}</Text>
            </View>
          </View>
        </View>

        {/* Notes (if any) */}
        {entry.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesLabel}>Note</Text>
            <Text style={styles.notesText}>{entry.notes}</Text>
          </View>
        ) : null}

        {/* Recorded By Staff Row */}
        <View style={styles.recordedByRow}>
          <Ionicons name="person-outline" size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
          <Text style={styles.recordedByText}>Recorded by {recordedBy}</Text>
        </View>

        {/* Edit Entry Action Button */}
        <TouchableOpacity
          style={styles.editEntryBtn}
          onPress={handleEditEntry}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Edit entry"
        >
          <Ionicons name="pencil" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
          <Text style={styles.editEntryBtnText}>Edit entry</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Confirmation Modal for Delete Purchase */}
      <ConfirmationModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Move Purchase to Recycle Bin?"
        message="This purchase record will be moved to the Recycle Bin. You can restore it anytime within 30 days."
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
  headerTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  deleteHeaderBtn: {
    width: TOUCH_TARGETS.minWidth,
    height: TOUCH_TARGETS.minHeight,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 40,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  customerMeta: {
    flex: 1,
    marginLeft: 14,
  },
  customerName: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  customerPhone: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dateText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  itemsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  itemsHeader: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 14,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  singleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  itemName: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemQty: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemPrice: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.borderSubtle,
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  totalLabel: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  totalBadge: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  totalValue: {
    ...TYPOGRAPHY.h2,
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  notesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  notesLabel: {
    ...TYPOGRAPHY.labelSmall,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginBottom: 4,
  },
  notesText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  recordedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  recordedByText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  editEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  editEntryBtnText: {
    ...TYPOGRAPHY.button,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
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
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
});

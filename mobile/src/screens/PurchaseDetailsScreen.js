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
          setEntry(details);
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
      if (Platform.OS === 'web') {
        alert('Purchase deleted and moved to Recycle Bin.');
      } else {
        Alert.alert('Deleted', 'Purchase moved to Recycle Bin.');
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not delete purchase');
    } finally {
      setDeleting(false);
    }
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
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Purchase Details</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Purchase record not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const medicines = entry.medicines || entry.items || [];
  const total = parseFloat(entry.total_amount || 0);
  const due = parseFloat(entry.due_amount || 0);
  const dateStr = entry.entry_date ? formatDate(entry.entry_date) : 'Recent';

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
        <Text style={styles.headerTitle}>Purchase Details</Text>
        <TouchableOpacity
          style={styles.deleteHeaderBtn}
          onPress={() => setShowDeleteModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Delete purchase"
        >
          <Ionicons name="trash-outline" size={22} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Date & Total Summary Card */}
        <View style={styles.summaryCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateLabel}>Purchase Date</Text>
            <Text style={styles.dateValue}>{dateStr}</Text>
          </View>
          <View style={styles.totalBadge}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{total.toFixed(0)}</Text>
          </View>
        </View>

        {/* Customer Info Card */}
        <TouchableOpacity
          style={styles.customerCard}
          onPress={() => {
            if (entry.customer_id) {
              navigation.navigate('CustomerProfile', {
                customerId: entry.customer_id,
                customer: {
                  customer_id: entry.customer_id,
                  name: entry.customer_name,
                  phone_number: entry.phone_number,
                },
              });
            }
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Customer: ${entry.customer_name || 'Customer'}`}
        >
          <Avatar name={entry.customer_name || 'Customer'} size={46} />
          <View style={styles.customerMeta}>
            <Text style={styles.customerSub}>Customer</Text>
            <Text style={styles.customerName}>{entry.customer_name || 'Unknown'}</Text>
            <Text style={styles.customerPhone}>{entry.phone_number || 'No phone'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* Medicines Breakdown */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Purchased Medicines ({medicines.length})</Text>
        </View>

        <View style={styles.medicineListCard}>
          {medicines.map((item, idx) => {
            const unitPrice = parseFloat(item.unit_price || item.price || 0);
            const lineTotal = (item.quantity || 1) * unitPrice;

            return (
              <View
                key={item.id || idx}
                style={[
                  styles.medicineRow,
                  idx < medicines.length - 1 ? styles.medicineRowBorder : null,
                ]}
              >
                <View style={styles.medIconBox}>
                  <Ionicons name="medkit" size={16} color={COLORS.primary} />
                </View>
                <View style={styles.medDetails}>
                  <Text style={styles.medName}>{item.medicine_name || item.name}</Text>
                  <Text style={styles.medQty}>
                    {item.quantity || 1} units × ₹{unitPrice.toFixed(0)}
                  </Text>
                </View>
                <Text style={styles.medPrice}>₹{lineTotal.toFixed(0)}</Text>
              </View>
            );
          })}
        </View>

        {/* Payment / Due Status */}
        {due > 0 && (
          <View style={styles.dueAlertCard}>
            <Ionicons name="alert-circle" size={20} color={COLORS.error} />
            <Text style={styles.dueAlertText}>
              Pending Due on this purchase: ₹{due.toFixed(0)}
            </Text>
          </View>
        )}

        {/* Notes */}
        {entry.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{entry.notes}</Text>
          </View>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => setShowDeleteModal(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Delete purchase"
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.error} style={{ marginRight: 6 }} />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Purchase Record?"
        message="This purchase record will be moved to the Recycle Bin. You can restore it anytime within 30 days."
        confirmText="Delete to Bin"
        cancelText="Keep Purchase"
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
  },
  deleteHeaderBtn: {
    width: TOUCH_TARGETS.minWidth,
    height: TOUCH_TARGETS.minHeight,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  dateValue: {
    ...TYPOGRAPHY.h3,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  totalBadge: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  totalValue: {
    ...TYPOGRAPHY.h2,
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  customerCard: {
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
  customerSub: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  customerName: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  customerPhone: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  sectionHeader: {
    marginVertical: SPACING.xs,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '700',
  },
  medicineListCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  medicineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  medicineRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  medIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  medDetails: {
    flex: 1,
  },
  medName: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  medQty: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  medPrice: {
    ...TYPOGRAPHY.label,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  dueAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECE7',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#F8B4A2',
  },
  dueAlertText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.error,
    marginLeft: SPACING.sm,
  },
  notesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notesLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  notesText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 20,
  },
  buttonRow: {
    marginTop: SPACING.sm,
  },
  deleteButton: {
    minHeight: TOUCH_TARGETS.minHeight,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FDECE7',
    borderWidth: 1,
    borderColor: '#F8B4A2',
  },
  deleteButtonText: {
    ...TYPOGRAPHY.label,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.error,
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
  emptyText: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.textMuted,
  },
});

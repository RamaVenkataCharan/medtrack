import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '../constants/theme';
import { getDeletedCustomers, restoreCustomer, permanentDeleteCustomer } from '../db/database';
import { formatLocalDateTime } from '../utils/dateUtils';
import { APIService } from '../services/apiService';

export default function RecycleBinScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [deletedCustomers, setDeletedCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    try {
      const list = getDeletedCustomers();
      setDeletedCustomers(list);
    } catch (err) {
      console.error('Error loading deleted customers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRestore = (item) => {
    try {
      restoreCustomer(item.customer_id);
      APIService.restoreCustomer(item.customer_id).catch((e) => console.warn('Sync restore error:', e));
      Alert.alert('Customer Restored', `"${item.name}" has been restored to the active customer list.`);
      loadData();
    } catch (err) {
      Alert.alert('Restore Failed', err.message || 'Could not restore customer.');
    }
  };

  const handlePermanentDelete = (item) => {
    Alert.alert(
      'Delete Permanently?',
      `Are you sure you want to permanently delete "${item.name}" and all their ${item.total_entries || 0} purchase history records?\n\n⚠️ This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => {
            try {
              permanentDeleteCustomer(item.customer_id);
              APIService.makeRequest(`/api/customers/${item.customer_id}/permanent`, 'DELETE').catch((e) => console.warn('Sync permanent delete error:', e));
              Alert.alert('Deleted', `"${item.name}" and all associated data have been permanently removed.`);
              loadData();
            } catch (err) {
              Alert.alert('Delete Failed', err.message || 'Could not permanently delete customer.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const totalDue = parseFloat(item.total_due || 0);
    const hasDue = totalDue > 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: SPACING.sm }}>
            <Text style={styles.customerName}>{item.name}</Text>
            <Text style={styles.phoneText}>
              <Ionicons name="call-outline" size={13} color={COLORS.textSecondary} /> {item.phone_number}
              {item.village ? ` • ${item.village}` : ''}
            </Text>
          </View>

          <View style={[styles.dueBadge, hasDue ? styles.dueBadgeAlert : styles.dueBadgeClear]}>
            <Text style={[styles.dueBadgeText, hasDue ? styles.dueBadgeTextAlert : styles.dueBadgeTextClear]}>
              {hasDue ? `₹${totalDue.toFixed(0)} due` : 'All clear'}
            </Text>
          </View>
        </View>

        <View style={styles.deletedDateRow}>
          <Ionicons name="time-outline" size={13} color={COLORS.textTertiary} />
          <Text style={styles.deletedDateText}>
            Deleted on: {formatLocalDateTime(item.deleted_at)}
          </Text>
          <Text style={styles.recordCountText}>
            ({item.total_entries || 0} purchases)
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={() => handleRestore(item)}
            activeOpacity={0.7}
            accessibilityLabel="Restore Customer"
          >
            <Ionicons name="arrow-undo-outline" size={16} color={COLORS.paymentGreen} />
            <Text style={styles.restoreBtnText}>Restore</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.permanentDeleteBtn}
            onPress={() => handlePermanentDelete(item)}
            activeOpacity={0.7}
            accessibilityLabel="Delete Permanently"
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
            <Text style={styles.permanentDeleteBtnText}>Delete Permanently</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const topPadding = Math.max(insets.top, (StatusBar.currentHeight || 0)) + SPACING.xs;

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Navigation Header */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Recycle Bin</Text>
          <Text style={styles.navSubtitle}>
            {deletedCustomers.length} soft-deleted customer{deletedCustomers.length === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : deletedCustomers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="trash-bin-outline" size={54} color={COLORS.borderStrong} />
          </View>
          <Text style={styles.emptyTitle}>Recycle Bin is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Customers you soft-delete will be stored here. You can restore them or permanently remove them anytime.
          </Text>
        </View>
      ) : (
        <FlatList
          data={deletedCustomers}
          keyExtractor={(item) => String(item.customer_id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backBtn: {
    padding: SPACING.xs,
    marginRight: SPACING.md,
  },
  navTitle: {
    ...FONTS.header,
    fontSize: 20,
    color: COLORS.textPrimary,
  },
  navSubtitle: {
    ...FONTS.subtext,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: 60,
  },
  card: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  customerName: {
    ...FONTS.header,
    fontSize: 17,
    color: COLORS.textPrimary,
  },
  phoneText: {
    ...FONTS.bodySecondary,
    fontSize: 13,
    marginTop: 2,
  },
  dueBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  dueBadgeAlert: {
    backgroundColor: COLORS.dueBadgeBg,
    borderColor: COLORS.dueBadgeBorder,
  },
  dueBadgeClear: {
    backgroundColor: COLORS.clearBadgeBg,
    borderColor: COLORS.clearBadgeBorder,
  },
  dueBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dueBadgeTextAlert: {
    color: COLORS.dueBadgeText,
  },
  dueBadgeTextClear: {
    color: COLORS.clearBadgeText,
  },
  deletedDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    gap: 4,
  },
  deletedDateText: {
    ...FONTS.subtext,
    color: COLORS.textTertiary,
    fontSize: 12,
  },
  recordCountText: {
    ...FONTS.subtext,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceSubtle,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paymentCardBg,
    borderWidth: 1,
    borderColor: COLORS.paymentCardBorder,
    paddingVertical: SPACING.xs + 3,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  restoreBtnText: {
    ...FONTS.bodySecondary,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.paymentGreen,
  },
  permanentDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: SPACING.xs + 3,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  permanentDeleteBtnText: {
    ...FONTS.bodySecondary,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.danger,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  emptyIconWrap: {
    width: 90,
    height: 90,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    ...FONTS.title,
    fontSize: 20,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    ...FONTS.bodySecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

// mobile/src/components/CustomerCard.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '../constants/theme';

export default function CustomerCard({ customer, onPress, onDelete }) {
  const numericDue = parseFloat(customer.total_due || 0);
  const hasDue = numericDue > 0;

  function formatDue(amount) {
    if (amount <= 0) return 'Paid';
    return `₹${amount.toFixed(amount % 1 === 0 ? 0 : 2)} due`;
  }

  const initial = (customer.name || 'C').trim().charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        hasDue ? styles.cardWithDue : styles.cardPaid,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Top Row: Avatar + Customer Details + Due Status Badge */}
      <View style={styles.topRow}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.name} numberOfLines={1}>{customer.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="call-outline" size={12} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.metaText}>{customer.phone_number}</Text>
            </View>

            {customer.village ? (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
                <Text style={styles.metaText}>{customer.village}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View
          style={[
            styles.dueBadge,
            hasDue ? styles.dueBadgeAlert : styles.dueBadgePaid,
          ]}
        >
          <Ionicons
            name={hasDue ? 'time-outline' : 'checkmark-circle'}
            size={12}
            color={hasDue ? COLORS.dueBadgeText : COLORS.paymentGreen}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.dueText,
              hasDue ? styles.dueTextAlert : styles.dueTextPaid,
            ]}
          >
            {formatDue(numericDue)}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Bottom Action Row: Enterprise Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Text style={styles.viewButtonText}>View Ledger</Text>
          <Ionicons name="chevron-forward" size={13} color={COLORS.primary} style={{ marginLeft: 3 }} />
        </TouchableOpacity>

        {onDelete ? (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={onDelete}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Delete customer"
          >
            <Ionicons name="trash-outline" size={15} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginVertical: SPACING.xs,
    marginHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardWithDue: {
    borderLeftWidth: 3.5,
    borderLeftColor: COLORS.primary,
  },
  cardPaid: {
    borderLeftWidth: 3.5,
    borderLeftColor: COLORS.paymentGreen,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  infoCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  dueBadgeAlert: {
    backgroundColor: COLORS.dueBadgeBg,
    borderColor: COLORS.dueBadgeBorder,
  },
  dueBadgePaid: {
    backgroundColor: COLORS.paymentCardBg,
    borderColor: COLORS.paymentCardBorder,
  },
  dueText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dueTextAlert: {
    color: COLORS.dueBadgeText,
  },
  dueTextPaid: {
    color: COLORS.paymentGreen,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.surfaceSubtle,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.xs,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryBorder,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
  },
  viewButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 6,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

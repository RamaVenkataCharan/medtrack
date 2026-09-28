import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, TOUCH_TARGETS } from '../constants/theme';
import { searchCustomers } from '../db/database';
import Avatar from '../components/Avatar';
import FilterPills from '../components/FilterPills';
import BottomNavBar from '../components/BottomNavBar';
import { formatDate } from '../utils/dateUtils';

export default function CustomerSearchScreen({ navigation, route }) {
  const [query, setQuery] = useState(route.params?.initialQuery || '');
  const [filter, setFilter] = useState('all');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await searchCustomers(query);
      let list = data || [];

      if (filter === 'recent') {
        list = [...list].sort(
          (a, b) => new Date(b.last_entry_date || b.created_at || 0) - new Date(a.last_entry_date || a.created_at || 0)
        );
      } else if (filter === 'frequent') {
        list = [...list].sort(
          (a, b) => (b.total_entries_count || 0) - (a.total_entries_count || 0)
        );
      }

      setCustomers(list);
    } catch (err) {
      console.warn('Error fetching customers in search:', err);
    } finally {
      setLoading(false);
    }
  }, [query, filter]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filterOptions = [
    { key: 'all', label: 'All', count: customers.length },
    { key: 'recent', label: 'Recent' },
    { key: 'frequent', label: 'Frequent' },
  ];

  const renderCustomerItem = ({ item }) => {
    const lastDate = item.last_entry_date || item.last_purchase_date;
    const formattedLastDate = lastDate ? formatDate(lastDate) : 'No purchases yet';
    const totalPurchases = item.total_entries_count ?? item.total_purchases ?? 0;
    const due = parseFloat(item.total_due || 0);

    return (
      <TouchableOpacity
        style={styles.customerCard}
        onPress={() => navigation.navigate('CustomerProfile', { customerId: item.customer_id, customer: item })}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, phone ${item.phone_number}, ${totalPurchases} purchases`}
      >
        <Avatar name={item.name} size={48} />
        <View style={styles.customerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.name}
            </Text>
            {due > 0 && (
              <View style={styles.dueBadge}>
                <Text style={styles.dueText}>Due ₹{due.toFixed(0)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.customerPhone}>{item.phone_number || 'No phone'}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {totalPurchases} {totalPurchases === 1 ? 'purchase' : 'purchases'}
            </Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>Last: {formattedLastDate}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>
    );
  };

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
        <Text style={styles.headerTitle}>Customers</Text>
        <TouchableOpacity
          style={styles.addCustomerHeaderBtn}
          onPress={() => navigation.navigate('AddCustomer')}
          accessibilityRole="button"
          accessibilityLabel="Add new customer"
        >
          <Ionicons name="person-add-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by customer name or phone..."
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Search customer input"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              accessibilityLabel="Clear search"
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Pills */}
      <View style={styles.pillsContainer}>
        <FilterPills
          options={filterOptions}
          selected={filter}
          onSelect={setFilter}
        />
      </View>

      {/* Customer List or Empty State */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Searching customer records...</Text>
        </View>
      ) : customers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="people-outline" size={44} color={COLORS.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No Customers Found</Text>
          <Text style={styles.emptySubtitle}>
            {query.length > 0
              ? `No customer matches "${query}". You can create a new customer record.`
              : 'Your customer list is currently empty.'}
          </Text>
          <TouchableOpacity
            style={styles.emptyAddBtn}
            onPress={() => navigation.navigate('AddCustomer', { initialName: query })}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add New Customer"
          >
            <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.emptyAddBtnText}>Add New Customer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => String(item.customer_id)}
          renderItem={renderCustomerItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* 5-Tab Navigation Bar */}
      <BottomNavBar currentRoute="Customers" navigation={navigation} />
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
  addCustomerHeaderBtn: {
    width: TOUCH_TARGETS.minWidth,
    height: TOUCH_TARGETS.minHeight,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  searchContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    backgroundColor: COLORS.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    minHeight: TOUCH_TARGETS.minHeight,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.text,
    paddingVertical: 10,
  },
  clearBtn: {
    padding: SPACING.xs,
  },
  pillsContainer: {
    backgroundColor: COLORS.surface,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  customerInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    marginRight: SPACING.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  customerName: {
    ...TYPOGRAPHY.h3,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  dueBadge: {
    backgroundColor: '#FDECE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#F8B4A2',
    marginLeft: 8,
  },
  dueText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 12,
    color: COLORS.error,
    fontWeight: '700',
  },
  customerPhone: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  metaDot: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginHorizontal: 6,
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
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  emptyAddBtn: {
    minHeight: TOUCH_TARGETS.minHeight,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  emptyAddBtnText: {
    ...TYPOGRAPHY.label,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});

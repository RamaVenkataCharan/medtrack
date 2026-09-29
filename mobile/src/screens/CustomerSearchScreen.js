import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import BottomNavBar from '../components/BottomNavBar';
import { formatDate } from '../utils/dateUtils';

export default function CustomerSearchScreen({ navigation, route }) {
  const [query, setQuery] = useState(route.params?.initialQuery || '');
  const [debouncedQuery, setDebouncedQuery] = useState(route.params?.initialQuery || '');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState(null);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // Debounce search query by 300ms
  const handleQueryChange = useCallback((text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(text);
    }, 300);
  }, []);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setSearchError(null);
    try {
      const data = await searchCustomers(debouncedQuery);
      setCustomers(data || []);
    } catch (err) {
      console.warn('Error fetching customers in search:', err);
      setSearchError(err.message || 'Could not load customers. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const customerCount = customers.length;

  const renderCustomerItem = ({ item }) => {
    const lastDate = item.last_purchase_date || item.last_activity || item.last_entry_date;
    const formattedLastDate = lastDate ? formatDate(lastDate) : 'No purchases yet';
    const due = parseFloat(item.total_due || 0);

    return (
      <TouchableOpacity
        testID={`customer-search-card-${item.customer_id}`}
        style={styles.customerCard}
        onPress={() => navigation.navigate('CustomerProfile', { customerId: item.customer_id, customer: item })}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, phone ${item.phone_number}`}
      >
        <Avatar name={item.name} size={46} showBorder />
        <View style={styles.customerInfo}>
          <Text style={styles.customerName} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>
            {item.name}
          </Text>
          <Text style={styles.customerPhone} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>
            {item.phone_number || 'No phone'}
          </Text>
          <Text style={styles.lastPurchaseText} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            Last purchase · {formattedLastDate}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="cust-search-back-btn"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Find a customer</Text>
        <TouchableOpacity
          testID="cust-search-add-header-btn"
          style={styles.addButton}
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
          <Ionicons name="search" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            testID="cust-search-input"
            style={styles.searchInput}
            placeholder="Search by name or phone..."
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={handleQueryChange}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="never"
            accessibilityLabel="Search customer input"
            maxFontSizeMultiplier={1.3}
            autoFocus={!route.params?.initialQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity
              testID="cust-search-clear-btn"
              onPress={() => { setQuery(''); setDebouncedQuery(''); inputRef.current?.focus(); }}
              accessibilityLabel="Clear search"
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results Count */}
      {!loading && !searchError && customers.length > 0 && (
        <View style={styles.countRow}>
          <Text style={styles.countText} maxFontSizeMultiplier={1.3}>
            {customerCount} {customerCount === 1 ? 'customer' : 'customers'}
          </Text>
        </View>
      )}

      {/* Customer List, Error, or Empty State */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText} maxFontSizeMultiplier={1.3}>Searching...</Text>
        </View>
      ) : searchError ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: COLORS.errorLight }]}>
            <Ionicons name="cloud-offline-outline" size={36} color={COLORS.error} />
          </View>
          <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.3}>Search Failed</Text>
          <Text style={styles.emptySubtitle} maxFontSizeMultiplier={1.3}>{searchError}</Text>
          <TouchableOpacity
            testID="cust-search-retry-btn"
            style={styles.emptyAddBtn}
            onPress={loadCustomers}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.emptyAddBtnText} maxFontSizeMultiplier={1.3}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : customers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="people-outline" size={36} color={COLORS.textMuted} />
          </View>
          <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.3}>No Customers Found</Text>
          <Text style={styles.emptySubtitle} maxFontSizeMultiplier={1.3}>
            {query.length > 0
              ? `No customer matches "${query}". You can create a new customer record.`
              : 'Your customer list is currently empty.'}
          </Text>
          <TouchableOpacity
            testID="cust-search-empty-add-btn"
            style={styles.emptyAddBtn}
            onPress={() => navigation.navigate('AddCustomer', { initialName: query })}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add New Customer"
          >
            <Ionicons name="add" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.emptyAddBtnText} maxFontSizeMultiplier={1.3}>Add New Customer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => String(item.customer_id)}
          renderItem={renderCustomerItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        />
      )}

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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 14 : 8,
    paddingBottom: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  addButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: COLORS.surface,
  },
  searchBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: COLORS.text,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  countRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  customerInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 4,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  customerPhone: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  lastPurchaseText: {
    fontSize: 13,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyAddBtn: {
    height: 48,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: RADIUS.md,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});

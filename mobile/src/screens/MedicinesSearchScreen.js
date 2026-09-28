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
import { searchCustomersByMedicine } from '../db/database';
import Avatar from '../components/Avatar';
import BottomNavBar from '../components/BottomNavBar';
import { formatDate } from '../utils/dateUtils';

export default function MedicinesSearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async (text) => {
    setQuery(text);
    if (!text || text.trim().length === 0) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await searchCustomersByMedicine(text);
      setResults(data || []);
    } catch (err) {
      console.warn('Medicine search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const renderResultItem = ({ item }) => {
    return (
      <View style={styles.resultCard}>
        <View style={styles.cardHeader}>
          <View style={styles.pillIconWrap}>
            <Ionicons name="medkit" size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.medicineName}>{item.medicine_name}</Text>
            <Text style={styles.medicineQty}>Quantity: {item.quantity || 1} units</Text>
          </View>
          <Text style={styles.purchaseDate}>{formatDate(item.purchase_date)}</Text>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.customerRow}
          onPress={() =>
            navigation.navigate('CustomerProfile', {
              customerId: item.customer_id,
              customer: {
                customer_id: item.customer_id,
                name: item.customer_name,
                phone_number: item.customer_phone,
              },
            })
          }
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`View customer ${item.customer_name}`}
        >
          <Avatar name={item.customer_name} size={36} />
          <View style={styles.customerDetails}>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            <Text style={styles.customerPhone}>{item.customer_phone || 'No phone'}</Text>
          </View>
          <View style={styles.viewProfileBtn}>
            <Text style={styles.viewProfileText}>View Customer</Text>
            <Ionicons name="arrow-forward" size={14} color={COLORS.primary} />
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Find by Medicine</Text>
        <Text style={styles.headerSubtitle}>
          See which customers purchased a particular medicine
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search medicine (e.g. Paracetamol, Amox...)"
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Medicine search input"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => handleSearch('')}
              accessibilityLabel="Clear medicine search"
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Searching customer purchases...</Text>
        </View>
      ) : query.trim().length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="medkit-outline" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>Search Any Medicine</Text>
          <Text style={styles.emptySubtitle}>
            Type any medicine name above to discover every customer who has purchased it, along with dates and quantities.
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="alert-circle-outline" size={48} color={COLORS.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No Purchases Found</Text>
          <Text style={styles.emptySubtitle}>
            No customers have recorded purchases for "{query}".
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id || item.entry_id + item.medicine_name)}
          renderItem={renderResultItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <BottomNavBar currentRoute="Medicines" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'android' ? 12 : SPACING.sm,
    paddingBottom: SPACING.xs,
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 22,
    color: COLORS.text,
    fontWeight: '700',
  },
  headerSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: SPACING.xs,
  },
  searchContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  resultCard: {
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
  pillIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  medicineName: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '700',
  },
  medicineQty: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  purchaseDate: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  customerDetails: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  customerName: {
    ...TYPOGRAPHY.label,
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '600',
  },
  customerPhone: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
  },
  viewProfileText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
    marginRight: 4,
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
    width: 80,
    height: 80,
    borderRadius: 40,
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
    lineHeight: 22,
  },
});

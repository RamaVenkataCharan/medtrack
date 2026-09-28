import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '../constants/theme';
import { searchCustomers, getActiveDriverName, getDeletedCustomerCount, softDeleteCustomer } from '../db/database';
import { exportKhataBackup } from '../services/exportService';
import { AuthService } from '../services/authService';
import { LocalMigrationService } from '../services/localMigrationService';
import NetworkBanner from '../components/NetworkBanner';
import CustomerCard from '../components/CustomerCard';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [deletedCount, setDeletedCount] = useState(0);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  useEffect(() => {
    AuthService.getCurrentUser().then((user) => {
      if (user?.phone) {
        setUserPhone(user.phone);
      }
    });
  }, []);

  const handleLogout = () => {
    const doLogout = async () => {
      await AuthService.logout();
    };

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' ? window.confirm('Are you sure you want to log out?') : true;
      if (confirmed) {
        doLogout();
      }
      return;
    }

    Alert.alert(
      'Logout',
      userPhone ? `Logged in as ${userPhone}.\nAre you sure you want to log out?` : 'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: doLogout,
        },
      ]
    );
  };

  // Check for pre-existing local SQLite data to upload
  useEffect(() => {
    LocalMigrationService.checkPendingLocalData().then(({ hasData, count }) => {
      if (hasData && count > 0) {
        Alert.alert(
          '📦 Local Khata Data Detected',
          `Found ${count} customer record(s) stored on this device from before the cloud migration. Would you like to upload them to your MedTrack Cloud account now?`,
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Upload to Cloud',
              onPress: async () => {
                try {
                  setLoading(true);
                  const res = await LocalMigrationService.migrateToCloud();
                  Alert.alert(
                    '✅ Upload Complete',
                    `Successfully migrated ${res.customersMigrated} customers and ${res.entriesMigrated} entries to MedTrack Cloud.`
                  );
                  loadData();
                } catch (migErr) {
                  Alert.alert('Upload Failed', migErr.message || 'Could not upload local data');
                } finally {
                  setLoading(false);
                }
              },
            },
          ]
        );
      }
    });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await searchCustomers(query);
      setCustomers(results || []);
      const count = await getDeletedCustomerCount();
      setDeletedCount(count || 0);
    } catch (e) {
      console.error('Error loading customers:', e);
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Dismiss profile dropdown on Web Escape key press
  useEffect(() => {
    if (!isProfileMenuOpen || Platform.OS !== 'web') return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsProfileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProfileMenuOpen]);

  // Reload when screen regains focus or query changes
  useFocusEffect(
    useCallback(() => {
      setIsProfileMenuOpen(false);
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    loadData();
  }, [query, loadData]);

  const handleExport = async () => {
    setExporting(true);
    await exportKhataBackup();
    setExporting(false);
  };

  const handleDeleteCustomer = (customer) => {
    const currentDue = parseFloat(customer.total_due || 0);
    const dueWarning = currentDue > 0
      ? `\n\n⚠️ Warning: ${customer.name} currently has an unpaid balance of ₹${currentDue.toFixed(2)}.`
      : '';

    Alert.alert(
      '🗑️ Delete Customer',
      `Are you sure you want to delete ${customer.name}? This can be restored from recycle bin.${dueWarning}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await softDeleteCustomer(customer.customer_id);
              Alert.alert('✅ Deleted', `"${customer.name}" moved to recycle bin`);
              loadData();
              const count = await getDeletedCustomerCount();
              setDeletedCount(count);
            } catch (err) {
              Alert.alert('❌ Error', err.message || 'Failed to delete customer');
            }
          },
        },
      ]
    );
  };

  const renderCustomerItem = ({ item }) => {
    return (
      <CustomerCard
        customer={item}
        onPress={() => navigation.navigate('CustomerProfile', { customerId: item.customer_id })}
        onDelete={() => handleDeleteCustomer(item)}
      />
    );
  };

  const topPadding = Math.max(insets.top, (StatusBar.currentHeight || 0)) + SPACING.sm;
  // Dynamic bottom clearance for 3-button nav and gesture bars:
  // Android 3-button nav bar is ~48px; guarantee at least 48px base inset + 24px extra breathing room
  const baseBottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 48 : 0);
  const bottomFabPadding = Math.max(baseBottomInset, Platform.OS === 'android' ? 48 : 0) + 24;

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 24 : SPACING.md) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <NetworkBanner />

      {/* Notebook Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: SPACING.xs }}>
          <Text style={styles.appTitle}>MedTrack</Text>
          <Text style={styles.appSubtitle} numberOfLines={1}>
            Medical Khata Book
          </Text>
        </View>

        <View style={styles.headerActions}>
          {/* Action 1: Backup (Unchanged) */}
          <TouchableOpacity
            style={styles.headerBackupBtn}
            onPress={handleExport}
            disabled={exporting}
            accessibilityLabel="Export Backup"
            activeOpacity={0.8}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
                <Text style={styles.headerBackupText}>Backup</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Action 2: Recycle Bin */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => {
              setIsProfileMenuOpen(false);
              navigation.navigate('RecycleBin');
            }}
            accessibilityLabel="Recycle Bin"
            activeOpacity={0.7}
          >
            <Ionicons name="trash-bin-outline" size={17} color={COLORS.textSecondary} />
            {deletedCount > 0 && (
              <View style={styles.actionBadgeDot} />
            )}
          </TouchableOpacity>

          {/* Action 3: User Profile Avatar Control */}
          <TouchableOpacity
            style={[
              styles.headerAvatarBtn,
              isProfileMenuOpen && styles.headerAvatarBtnActive,
            ]}
            onPress={() => setIsProfileMenuOpen((prev) => !prev)}
            accessibilityLabel="User Profile Menu"
            accessibilityRole="button"
            accessibilityExpanded={isProfileMenuOpen}
            activeOpacity={0.7}
          >
            <Ionicons
              name="person-outline"
              size={18}
              color={isProfileMenuOpen ? COLORS.primary : COLORS.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Floating User Profile Dropdown Menu */}
      {isProfileMenuOpen && (
        <>
          <TouchableWithoutFeedback onPress={() => setIsProfileMenuOpen(false)}>
            <View style={styles.menuBackdrop} />
          </TouchableWithoutFeedback>
          <View style={[styles.profileDropdown, { top: topPadding + 44 }]} accessibilityRole="menu">
            {/* 1. My Profile */}
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setIsProfileMenuOpen(false);
                navigation.navigate('Settings', { initialSection: 'profile' });
              }}
              accessibilityRole="menuitem"
              accessibilityLabel="My Profile"
              activeOpacity={0.7}
            >
              <View style={styles.dropdownItemIconWrap}>
                <Ionicons name="person-outline" size={17} color={COLORS.textPrimary} />
              </View>
              <Text style={styles.dropdownItemText}>My Profile</Text>
            </TouchableOpacity>

            {/* 2. Account Settings */}
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setIsProfileMenuOpen(false);
                navigation.navigate('Settings', { initialSection: 'settings' });
              }}
              accessibilityRole="menuitem"
              accessibilityLabel="Account Settings"
              activeOpacity={0.7}
            >
              <View style={styles.dropdownItemIconWrap}>
                <Ionicons name="settings-outline" size={17} color={COLORS.textPrimary} />
              </View>
              <Text style={styles.dropdownItemText}>Account Settings</Text>
            </TouchableOpacity>

            <View style={styles.dropdownDivider} />

            {/* 3. Logout */}
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setIsProfileMenuOpen(false);
                handleLogout();
              }}
              accessibilityRole="menuitem"
              accessibilityLabel="Logout"
              activeOpacity={0.7}
            >
              <View style={styles.dropdownItemIconWrap}>
                <Ionicons name="log-out-outline" size={17} color={COLORS.danger} />
              </View>
              <Text style={[styles.dropdownItemText, styles.dropdownLogoutText]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Auto-focused Large Search Box */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by phone or name..."
          placeholderTextColor={COLORS.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoFocus={true}
          keyboardType="default"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearSearchBtn}>
            <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Customer List or Empty Match */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : customers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={48} color={COLORS.borderStrong} />
          <Text style={styles.emptyTitle}>
            {query.trim() ? `No customer matching "${query}"` : 'No customers yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            Add this customer to start tracking medicines and purchases.
          </Text>
          <TouchableOpacity
            style={styles.addCustomerEmptyBtn}
            onPress={() => navigation.navigate('AddCustomer', { initialPhoneOrName: query.trim() })}
          >
            <Ionicons name="person-add-outline" size={20} color={COLORS.textInverted} />
            <Text style={styles.addCustomerEmptyBtnText}>+ Add Customer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => String(item.customer_id)}
          renderItem={renderCustomerItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomFabPadding + 64 }]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Add Customer Button */}
      {customers.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { bottom: bottomFabPadding }]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AddCustomer', { initialPhoneOrName: query.trim() })}
        >
          <Ionicons name="person-add" size={18} color={COLORS.textInverted} />
          <Text style={styles.fabText}>+ Add Customer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  appTitle: {
    ...FONTS.title,
    color: COLORS.primary,
  },
  appSubtitle: {
    ...FONTS.subtext,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBackupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  headerBackupText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  headerAvatarBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  headerAvatarBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 998,
  },
  profileDropdown: {
    position: 'absolute',
    right: SPACING.xl,
    width: 195,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 999,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    marginHorizontal: 4,
  },
  dropdownItemIconWrap: {
    width: 22,
    marginRight: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownItemText: {
    ...FONTS.body,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  dropdownLogoutText: {
    color: COLORS.danger,
    fontWeight: '600',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
    marginHorizontal: SPACING.xs,
  },
  actionBadgeDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.primary,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.xl,
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    height: 52,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body,
    height: '100%',
  },
  clearSearchBtn: {
    padding: SPACING.xs,
  },
  listContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 85,
    paddingTop: SPACING.xs,
  },
  customerCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  customerName: {
    ...FONTS.header,
    flex: 1,
    marginRight: SPACING.sm,
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
  cardDetails: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  detailText: {
    ...FONTS.bodySecondary,
    fontSize: 13,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  emptyTitle: {
    ...FONTS.header,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...FONTS.bodySecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.xl,
  },
  addCustomerEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.pill,
    gap: SPACING.sm,
  },
  addCustomerEmptyBtnText: {
    ...FONTS.body,
    fontWeight: '600',
    color: COLORS.textInverted,
  },
  fab: {
    position: 'absolute',
    bottom: SPACING.xxl,
    right: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.pill,
    gap: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  fabText: {
    ...FONTS.body,
    fontWeight: '600',
    color: COLORS.textInverted,
  },
});

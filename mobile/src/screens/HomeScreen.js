import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, TOUCH_TARGETS } from '../constants/theme';
import {
  getDashboardSummary,
  getShopProfile,
  getDeletedCustomerCount,
} from '../db/database';
import { exportKhataBackup } from '../services/exportService';
import { AuthService } from '../services/authService';
import Avatar from '../components/Avatar';
import StatCard from '../components/StatCard';
import BottomNavBar from '../components/BottomNavBar';
import NetworkBanner from '../components/NetworkBanner';
import { formatDate } from '../utils/dateUtils';

export default function HomeScreen({ navigation }) {
  const [shopName, setShopName] = useState('Sri Sai Medicals');
  const [summary, setSummary] = useState({
    todayPurchases: 0,
    todayCustomers: 0,
    todaySales: 0,
    todayDues: 0,
    recentCustomers: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [deletedCount, setDeletedCount] = useState(0);
  const [userEmail, setUserEmail] = useState('');

  const todayStr = (() => {
    const now = new Date();
    const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    return now.toLocaleDateString('en-IN', options);
  })();

  const loadData = useCallback(async () => {
    try {
      const [sumData, profileData, delCount, user] = await Promise.all([
        getDashboardSummary().catch(() => null),
        getShopProfile().catch(() => null),
        getDeletedCustomerCount().catch(() => 0),
        AuthService.getCurrentUser().catch(() => null),
      ]);

      if (sumData) {
        setSummary(sumData);
      }
      if (profileData?.shop_name || profileData?.name) {
        setShopName(profileData.shop_name || profileData.name);
      }
      setDeletedCount(delCount || 0);
      if (user) {
        setUserEmail(user.email || user.phone || '');
      }
    } catch (e) {
      console.warn('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsProfileMenuOpen(false);
      loadData();
    }, [loadData])
  );

  const handleLogout = () => {
    setIsProfileMenuOpen(false);
    const doLogout = async () => {
      await AuthService.logout();
    };

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' ? window.confirm('Are you sure you want to log out of MedTrack?') : true;
      if (confirmed) {
        doLogout();
      }
      return;
    }

    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of your MedTrack account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: doLogout },
      ]
    );
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim().length > 0) {
      navigation.navigate('CustomerSearch', { initialQuery: searchQuery.trim() });
    } else {
      navigation.navigate('CustomerSearch');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <NetworkBanner />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greetingText}>Good Morning,</Text>
          <Text style={styles.shopNameText} numberOfLines={1}>
            {shopName}
          </Text>
          <Text style={styles.dateText}>{todayStr}</Text>
        </View>

        <View style={styles.headerRight}>
          {/* Avatar button opening minimal dropdown */}
          <TouchableOpacity
            style={[
              styles.avatarBtn,
              isProfileMenuOpen && styles.avatarBtnActive,
            ]}
            onPress={() => setIsProfileMenuOpen((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="User profile menu"
            accessibilityExpanded={isProfileMenuOpen}
            activeOpacity={0.7}
          >
            <Avatar name={shopName} size={42} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Floating Profile Dropdown Menu */}
      {isProfileMenuOpen && (
        <>
          <TouchableWithoutFeedback onPress={() => setIsProfileMenuOpen(false)}>
            <View style={styles.menuBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.dropdownMenu}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setIsProfileMenuOpen(false);
                navigation.navigate('Settings', { initialSection: 'profile' });
              }}
              accessibilityRole="menuitem"
              accessibilityLabel="My Profile"
            >
              <Ionicons name="person-outline" size={18} color={COLORS.text} style={styles.dropdownIcon} />
              <Text style={styles.dropdownItemText}>My Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setIsProfileMenuOpen(false);
                navigation.navigate('Settings', { initialSection: 'settings' });
              }}
              accessibilityRole="menuitem"
              accessibilityLabel="Account Settings"
            >
              <Ionicons name="settings-outline" size={18} color={COLORS.text} style={styles.dropdownIcon} />
              <Text style={styles.dropdownItemText}>Account Settings</Text>
            </TouchableOpacity>

            <View style={styles.dropdownDivider} />

            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={handleLogout}
              accessibilityRole="menuitem"
              accessibilityLabel="Log Out"
            >
              <Ionicons name="log-out-outline" size={18} color={COLORS.error} style={styles.dropdownIcon} />
              <Text style={[styles.dropdownItemText, { color: COLORS.error }]}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Large Customer Search Bar */}
        <View style={styles.searchSection}>
          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => navigation.navigate('CustomerSearch')}
            activeOpacity={0.8}
            accessibilityRole="search"
            accessibilityLabel="Search customer by name or phone"
          >
            <Ionicons name="search" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search customer by name or phone..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            <TouchableOpacity
              onPress={handleSearchSubmit}
              style={styles.searchSubmitBtn}
              accessibilityLabel="Execute search"
            >
              <Ionicons name="arrow-forward-circle" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Two Hero Action Cards */}
        <View style={styles.heroRow}>
          {/* Card 1: Find Customer */}
          <TouchableOpacity
            style={[styles.heroCard, styles.heroCardDark]}
            onPress={() => navigation.navigate('CustomerSearch')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Find Customer. Search & view history."
          >
            <View style={styles.heroIconBoxDark}>
              <Ionicons name="search" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.heroTitleLight}>Find Customer</Text>
            <Text style={styles.heroSubtitleLight}>Search & view history</Text>
          </TouchableOpacity>

          {/* Card 2: Record Purchase */}
          <TouchableOpacity
            style={[styles.heroCard, styles.heroCardPrimary]}
            onPress={() => navigation.navigate('AddPurchase')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Record Purchase. Add customer or medicines."
          >
            <View style={styles.heroIconBoxPrimary}>
              <Ionicons name="add" size={26} color={COLORS.primary} />
            </View>
            <Text style={styles.heroTitleLight}>Record Purchase</Text>
            <Text style={styles.heroSubtitleLight}>Add customer or medicines</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Summary */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Today's Summary</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('CustomerSearch', { initialFilter: 'recent' })}
            accessibilityRole="button"
            accessibilityLabel="See all summary"
          >
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            label="Purchases"
            value={summary.todayPurchases}
            style={styles.statCardItem}
          />
          <StatCard
            label="Customers"
            value={summary.todayCustomers}
            style={styles.statCardItem}
          />
          <StatCard
            label="Sales"
            value={`₹${summary.todaySales}`}
            highlightColor={COLORS.primary}
            style={styles.statCardItem}
          />
          <StatCard
            label="Due"
            value={`₹${summary.todayDues}`}
            highlightColor={summary.todayDues > 0 ? COLORS.error : COLORS.text}
            style={styles.statCardItem}
          />
        </View>

        {/* Recent Customers */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Customers</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('CustomerSearch')}
            accessibilityRole="button"
            accessibilityLabel="See all customers"
          >
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : summary.recentCustomers.length === 0 ? (
          <View style={styles.emptyRecentCard}>
            <Ionicons name="people-outline" size={36} color={COLORS.textMuted} />
            <Text style={styles.emptyRecentText}>No recent customers yet.</Text>
            <TouchableOpacity
              style={styles.emptyAddCustBtn}
              onPress={() => navigation.navigate('AddCustomer')}
            >
              <Text style={styles.emptyAddCustBtnText}>+ Add First Customer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.recentList}>
            {summary.recentCustomers.map((cust) => {
              const formattedDate = cust.last_purchase_date
                ? formatDate(cust.last_purchase_date)
                : 'Recent';

              return (
                <TouchableOpacity
                  key={cust.customer_id}
                  style={styles.recentCustomerItem}
                  onPress={() =>
                    navigation.navigate('CustomerProfile', {
                      customerId: cust.customer_id,
                      customer: cust,
                    })
                  }
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${cust.name}, last purchase ${formattedDate}`}
                >
                  <Avatar name={cust.name} size={44} />
                  <View style={styles.recentMeta}>
                    <Text style={styles.recentName}>{cust.name}</Text>
                    <Text style={styles.recentDate}>Last purchase: {formattedDate}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* 5-Tab Navigation Bar */}
      <BottomNavBar currentRoute="Home" navigation={navigation} />
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
  headerLeft: {
    flex: 1,
  },
  greetingText: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  shopNameText: {
    ...TYPOGRAPHY.h2,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 1,
  },
  dateText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBtn: {
    padding: 2,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarBtnActive: {
    borderColor: COLORS.primary,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 998,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 75,
    right: SPACING.lg,
    width: 200,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
    paddingVertical: SPACING.xs,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    minHeight: 44,
  },
  dropdownIcon: {
    marginRight: SPACING.sm,
  },
  dropdownItemText: {
    ...TYPOGRAPHY.label,
    fontSize: 14,
    color: COLORS.text,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  searchSection: {
    marginBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    minHeight: TOUCH_TARGETS.minHeight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
  searchSubmitBtn: {
    padding: SPACING.xs,
  },
  heroRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  heroCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    justifyContent: 'space-between',
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroCardDark: {
    backgroundColor: '#352520',
  },
  heroCardPrimary: {
    backgroundColor: COLORS.primary,
  },
  heroIconBoxDark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  heroIconBoxPrimary: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  heroTitleLight: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSubtitleLight: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  seeAllText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  statCardItem: {
    flex: 1,
    paddingHorizontal: 4,
  },
  recentList: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  recentCustomerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minHeight: TOUCH_TARGETS.minHeight,
  },
  recentMeta: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  recentName: {
    ...TYPOGRAPHY.label,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  recentDate: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emptyRecentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyRecentText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  emptyAddCustBtn: {
    minHeight: TOUCH_TARGETS.minHeight,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyAddCustBtnText: {
    ...TYPOGRAPHY.label,
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '700',
  },
  loadingContainer: {
    padding: SPACING.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

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
  const [userName, setUserName] = useState('');
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

  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

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
        // Extract first name from email or use a default
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
        setUserName(name.charAt(0).toUpperCase() + name.slice(1));
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

      {/* Top Header — Greeting & Avatar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greetingText} maxFontSizeMultiplier={1.3}>
            {getGreeting()}, {userName || 'there'}
          </Text>
          <Text style={styles.shopNameText} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {shopName}
          </Text>
        </View>

        <TouchableOpacity
          testID="home-header-avatar-btn"
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
          <Avatar name={userName || shopName} size={40} showBorder />
        </TouchableOpacity>
      </View>

      {/* Floating Profile Dropdown Menu */}
      {isProfileMenuOpen && (
        <>
          <TouchableWithoutFeedback onPress={() => setIsProfileMenuOpen(false)}>
            <View style={styles.menuBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.dropdownMenu}>
            <TouchableOpacity
              testID="home-menu-profile"
              style={styles.dropdownItem}
              onPress={() => {
                setIsProfileMenuOpen(false);
                navigation.navigate('Settings', { initialSection: 'profile' });
              }}
              accessibilityRole="menuitem"
              accessibilityLabel="My Profile"
            >
              <Ionicons name="person-outline" size={18} color={COLORS.text} style={styles.dropdownIcon} />
              <Text style={styles.dropdownItemText} maxFontSizeMultiplier={1.3}>My Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="home-menu-settings"
              style={styles.dropdownItem}
              onPress={() => {
                setIsProfileMenuOpen(false);
                navigation.navigate('Settings', { initialSection: 'settings' });
              }}
              accessibilityRole="menuitem"
              accessibilityLabel="Account Settings"
            >
              <Ionicons name="settings-outline" size={18} color={COLORS.text} style={styles.dropdownIcon} />
              <Text style={styles.dropdownItemText} maxFontSizeMultiplier={1.3}>Account Settings</Text>
            </TouchableOpacity>

            <View style={styles.dropdownDivider} />

            <TouchableOpacity
              testID="home-menu-logout"
              style={styles.dropdownItem}
              onPress={handleLogout}
              accessibilityRole="menuitem"
              accessibilityLabel="Log Out"
            >
              <Ionicons name="log-out-outline" size={18} color={COLORS.error} style={styles.dropdownIcon} />
              <Text style={[styles.dropdownItemText, { color: COLORS.error }]} maxFontSizeMultiplier={1.3}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Customer Search Bar */}
        <TouchableOpacity
          testID="home-search-bar-btn"
          style={styles.searchBar}
          onPress={() => navigation.navigate('CustomerSearch')}
          activeOpacity={0.8}
          accessibilityRole="search"
          accessibilityLabel="Search customer by name or phone"
        >
          <Ionicons name="search" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
          <Text style={styles.searchPlaceholder} maxFontSizeMultiplier={1.3}>
            Search customers by name or phone
          </Text>
        </TouchableOpacity>

        {/* Record Purchase CTA */}
        <TouchableOpacity
          testID="home-hero-record-purchase"
          style={styles.recordPurchaseBtn}
          onPress={() => navigation.navigate('AddPurchase')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Record a new purchase"
        >
          <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.recordPurchaseBtnText} maxFontSizeMultiplier={1.3}>Record purchase</Text>
        </TouchableOpacity>

        {/* Recent Customers Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.3}>Recent customers</Text>
          <TouchableOpacity
            testID="home-see-all-recent"
            onPress={() => navigation.navigate('CustomerSearch')}
            accessibilityRole="button"
            accessibilityLabel="See all customers"
          >
            <Text style={styles.seeAllText} maxFontSizeMultiplier={1.3}>See all</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : summary.recentCustomers.length === 0 ? (
          <View style={styles.emptyRecentCard}>
            <Ionicons name="people-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyRecentText} maxFontSizeMultiplier={1.3}>No recent customers yet.</Text>
            <TouchableOpacity
              testID="home-empty-add-customer-btn"
              style={styles.emptyAddCustBtn}
              onPress={() => navigation.navigate('AddCustomer')}
            >
              <Text style={styles.emptyAddCustBtnText} maxFontSizeMultiplier={1.3}>+ Add First Customer</Text>
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
                  testID={`home-recent-customer-${cust.customer_id}`}
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
                  <Avatar name={cust.name} size={42} showBorder />
                  <View style={styles.recentMeta}>
                    <Text style={styles.recentName} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>
                      {cust.name}
                    </Text>
                    <Text style={styles.recentDate} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>
                      Last purchase · {formattedDate}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* 2-Tab Navigation Bar */}
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 10,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
  },
  headerLeft: {
    flex: 1,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  shopNameText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  avatarBtn: {
    padding: 2,
    borderRadius: 24,
  },
  avatarBtnActive: {
    // subtle glow on active
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
    top: 80,
    right: 20,
    width: 200,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 999,
    paddingVertical: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  dropdownIcon: {
    marginRight: 10,
  },
  dropdownItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  searchBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textMuted,
  },
  recordPurchaseBtn: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  recordPurchaseBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  seeAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
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
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minHeight: 60,
  },
  recentMeta: {
    flex: 1,
    marginLeft: 12,
  },
  recentName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  recentDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emptyRecentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyRecentText: {
    fontSize: 15,
    color: COLORS.textMuted,
    marginTop: 8,
    marginBottom: 16,
  },
  emptyAddCustBtn: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyAddCustBtnText: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '700',
  },
  loadingContainer: {
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

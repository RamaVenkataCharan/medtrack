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
import { AuthService } from '../services/authService';
import { exportKhataBackup } from '../services/exportService';
import { getShopProfile, getDeletedCustomerCount } from '../db/database';
import BottomNavBar from '../components/BottomNavBar';
import Avatar from '../components/Avatar';

export default function MoreScreen({ navigation }) {
  const [shopName, setShopName] = useState('My Pharmacy');
  const [pharmacistName, setPharmacistName] = useState('Pharmacist');
  const [userEmail, setUserEmail] = useState('');
  const [deletedCount, setDeletedCount] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const user = await AuthService.getCurrentUser();
        if (user) {
          setUserEmail(user.email || user.phone || '');
        }
        const profile = await getShopProfile();
        if (profile) {
          setShopName(profile.shop_name || profile.name || 'Sri Sai Medicals');
          setPharmacistName(profile.pharmacist_name || 'Rama Venkata Charan');
        }
        const count = await getDeletedCustomerCount();
        setDeletedCount(count || 0);
      } catch (err) {
        console.warn('Failed to load profile in MoreScreen:', err);
      }
    }
    init();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportKhataBackup();
    } catch (e) {
      Alert.alert('Export Failed', e.message || 'Could not export records');
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = () => {
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

  const menuSections = [
    {
      title: 'Pharmacy Information',
      items: [
        {
          id: 'shop_info',
          title: 'Shop Information',
          subtitle: 'Name, address, contact, and drug licence',
          icon: 'business-outline',
          target: 'ShopInfo',
        },
        {
          id: 'pharmacist_details',
          title: 'Pharmacist Details',
          subtitle: 'Licence number, validity, and credentials',
          icon: 'person-outline',
          target: 'PharmacistDetails',
        },
        {
          id: 'reminders',
          title: 'Licence Reminders',
          subtitle: 'Expiry alerts and renewal countdowns',
          icon: 'notifications-outline',
          target: 'Reminders',
        },
      ],
    },
    {
      title: 'Data & Safety',
      items: [
        {
          id: 'recycle_bin',
          title: 'Recycle Bin',
          subtitle: 'Restore deleted customers & purchases',
          icon: 'trash-bin-outline',
          badge: deletedCount > 0 ? `${deletedCount}` : null,
          target: 'RecycleBin',
        },
        {
          id: 'export_data',
          title: 'Export Backup',
          subtitle: 'Download complete offline encrypted JSON backup',
          icon: 'cloud-download-outline',
          action: handleExport,
          loading: exporting,
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          id: 'settings',
          title: 'Account Settings',
          subtitle: 'App preferences and login status',
          icon: 'settings-outline',
          target: 'Settings',
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More & Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Pharmacy Profile Card */}
        <View style={styles.profileHeaderCard}>
          <Avatar name={shopName} size={54} />
          <View style={styles.profileHeaderMeta}>
            <Text style={styles.pharmacyName}>{shopName}</Text>
            <Text style={styles.pharmacistSub}>Pharmacist: {pharmacistName}</Text>
            {userEmail ? <Text style={styles.userEmailText}>{userEmail}</Text> : null}
          </View>
        </View>

        {/* Menu Groups */}
        {menuSections.map((section, sIdx) => (
          <View key={sIdx} style={styles.groupContainer}>
            <Text style={styles.groupHeader}>{section.title}</Text>
            <View style={styles.groupCard}>
              {section.items.map((item, iIdx) => {
                const isLast = iIdx === section.items.length - 1;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.menuItem, !isLast ? styles.menuItemBorder : null]}
                    onPress={() => {
                      if (item.action) {
                        item.action();
                      } else if (item.target) {
                        navigation.navigate(item.target);
                      }
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                  >
                    <View style={styles.itemIconWrap}>
                      <Ionicons name={item.icon} size={20} color={COLORS.primary} />
                    </View>
                    <View style={styles.itemMeta}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      {item.subtitle ? (
                        <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                      ) : null}
                    </View>
                    {item.loading ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : item.badge ? (
                      <View style={styles.badgeWrap}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Log out of MedTrack"
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNavBar currentRoute="More" navigation={navigation} />
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
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 22,
    color: COLORS.text,
    fontWeight: '700',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  profileHeaderMeta: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  pharmacyName: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  pharmacistSub: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  userEmailText: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  groupContainer: {
    marginBottom: SPACING.md,
  },
  groupHeader: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  groupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    minHeight: TOUCH_TARGETS.minHeight,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  itemMeta: {
    flex: 1,
  },
  itemTitle: {
    ...TYPOGRAPHY.label,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  itemSubtitle: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badgeWrap: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECE7',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    minHeight: TOUCH_TARGETS.minHeight,
    borderWidth: 1,
    borderColor: '#F8B4A2',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  logoutText: {
    ...TYPOGRAPHY.label,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.error,
  },
});

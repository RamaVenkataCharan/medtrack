import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '../constants/theme';
import { getShopProfile, saveShopProfile, getDeletedCustomerCount } from '../db/database';
import { exportKhataBackup } from '../services/exportService';
import { LocalMigrationService } from '../services/localMigrationService';
import { AuthService } from '../services/authService';
import NetworkBanner from '../components/NetworkBanner';

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [deletedCount, setDeletedCount] = useState(0);

  const [profile, setProfile] = useState({
    shop_name: '',
    shop_license_no: '',
    license_20b: '',
    license_21b: '',
    shop_license_validity: '',
    shop_phone: '',
    pharmacist_name: '',
    pharmacist_phone: '',
    pharmacist_license_validity: '',
  });

  const getValidityBadge = (dateStr) => {
    if (!dateStr) return null;
    const expiryDate = new Date(dateStr);
    if (isNaN(expiryDate.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    return {
      text: days < 0 ? `Expired (${Math.abs(days)}d ago)` : `Valid • ${days} days left`,
      isValid: days >= 0,
    };
  };

  const handleLogout = () => {
    const doLogout = async () => {
      try {
        await AuthService.logout();
        if (navigation.replace) {
          navigation.replace('Login');
        } else if (navigation.navigate) {
          navigation.navigate('Login');
        }
      } catch (err) {
        console.warn('Logout notice:', err);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' ? window.confirm('Are you sure you want to sign out of your store session?') : true;
      if (confirmed) {
        doLogout();
      }
      return;
    }

    Alert.alert(
      'Sign Out',
      'Are you sure you want to securely sign out of your store session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: doLogout,
        },
      ]
    );
  };

  const loadData = useCallback(async () => {
    try {
      const data = await getShopProfile();
      if (data) {
        setProfile({
          shop_name: data.shop_name || '',
          shop_license_no: data.shop_license_no || '',
          license_20b: data.license_20b || data.shop_license_no || '',
          license_21b: data.license_21b || '',
          shop_license_validity: data.shop_license_validity || '',
          shop_phone: data.shop_phone || '',
          pharmacist_name: data.pharmacist_name || '',
          pharmacist_phone: data.pharmacist_phone || '',
          pharmacist_license_validity: data.pharmacist_license_validity || '',
        });
      }
      const count = await getDeletedCustomerCount();
      setDeletedCount(count || 0);
    } catch (e) {
      console.warn('Could not load settings:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveShopProfile(profile);
      Alert.alert('Settings Saved', 'Shop & Pharmacist profile updated successfully.');
    } catch (e) {
      Alert.alert('Save Failed', e.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleMigrateLocalData = async () => {
    setMigrating(true);
    try {
      const check = await LocalMigrationService.checkPendingLocalData();
      if (!check.hasData || check.count === 0) {
        Alert.alert('No Local Data', 'No offline SQLite data found to upload, or data has already been migrated.');
        return;
      }

      Alert.alert(
        'Upload Local Data',
        `Found ${check.count} local customer record(s). Upload to MedTrack Cloud under your account?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upload',
            onPress: async () => {
              try {
                setMigrating(true);
                const res = await LocalMigrationService.migrateToCloud();
                Alert.alert(
                  'Upload Succeeded',
                  `Successfully uploaded ${res.customersMigrated} customers and ${res.entriesMigrated} ledger entries to your MedTrack Cloud account.`
                );
                await loadData();
              } catch (err) {
                Alert.alert('Upload Failed', err.message || 'Could not upload data');
              } finally {
                setMigrating(false);
              }
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not check local data');
    } finally {
      setMigrating(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    await exportKhataBackup();
    setExporting(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const shopBadge = getValidityBadge(profile.shop_license_validity);
  const pharmacistBadge = getValidityBadge(profile.pharmacist_license_validity);

  const topPadding = Math.max(insets.top, (StatusBar.currentHeight || 0)) + SPACING.xs;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={[styles.navBar, { paddingTop: topPadding }]}>
        <TouchableOpacity
          testID="settings-back-btn"
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle} maxFontSizeMultiplier={1.3}>Settings & Storage</Text>
      </View>
      <NetworkBanner />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* RECYCLE BIN CARD */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.3}>Data Management</Text>
        </View>

        <TouchableOpacity
          testID="settings-recycle-bin-btn"
          style={styles.recycleBinRow}
          onPress={() => navigation.navigate('RecycleBin')}
          activeOpacity={0.7}
        >
          <View style={styles.recycleIconWrap}>
            <Ionicons name="trash-bin-outline" size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.recycleTitle} maxFontSizeMultiplier={1.3}>Recycle Bin</Text>
            <Text style={styles.recycleSubtitle} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>
              {deletedCount > 0
                ? `${deletedCount} soft-deleted customer${deletedCount === 1 ? '' : 's'} available to restore`
                : 'No deleted customers currently in bin'}
            </Text>
          </View>
          {deletedCount > 0 && (
            <View style={styles.recycleCountBadge}>
              <Text style={styles.recycleCountText} maxFontSizeMultiplier={1.3}>{deletedCount}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="settings-export-backup-btn"
          style={styles.recycleBinRow}
          onPress={handleExport}
          disabled={exporting}
          activeOpacity={0.7}
        >
          <View style={[styles.recycleIconWrap, { backgroundColor: COLORS.paymentCardBg }]}>
            <Ionicons name="share-outline" size={18} color={COLORS.paymentGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.recycleTitle} maxFontSizeMultiplier={1.3}>Full JSON / SQLite Backup</Text>
            <Text style={styles.recycleSubtitle} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>
              Includes active & soft-deleted records with status flags
            </Text>
          </View>
          {exporting ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
          )}
        </TouchableOpacity>

        {/* Action: Upload local SQLite data to cloud */}
        <TouchableOpacity
          testID="settings-migrate-data-btn"
          style={styles.recycleBinRow}
          onPress={handleMigrateLocalData}
          disabled={migrating}
          activeOpacity={0.7}
        >
          <View style={[styles.recycleIconWrap, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <Ionicons name="cloud-upload-outline" size={18} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.recycleTitle} maxFontSizeMultiplier={1.3}>Upload Local Data to Cloud</Text>
            <Text style={styles.recycleSubtitle} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>
              Sync pre-existing offline SQLite records into MedTrack Cloud
            </Text>
          </View>
          {migrating ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
          )}
        </TouchableOpacity>

        {/* SHOP PROFILE */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.3}>Medical Store Profile</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>Shop Name</Text>
          <TextInput
            testID="settings-shop-name-input"
            style={styles.input}
            placeholder="e.g. MedTrack Medical & General Store"
            placeholderTextColor={COLORS.textTertiary}
            value={profile.shop_name}
            onChangeText={(v) => handleChange('shop_name', v)}
            maxFontSizeMultiplier={1.3}
          />

          <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>Shop License Number (Form 20B)</Text>
          <TextInput
            testID="settings-license-20b-input"
            style={styles.input}
            placeholder="e.g. 20B/1234/2024"
            placeholderTextColor={COLORS.textTertiary}
            value={profile.license_20b}
            onChangeText={(v) => handleChange('license_20b', v)}
            maxFontSizeMultiplier={1.3}
          />

          <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>Shop License Number (Form 21B)</Text>
          <TextInput
            testID="settings-license-21b-input"
            style={styles.input}
            placeholder="e.g. 21B/5678/2024"
            placeholderTextColor={COLORS.textTertiary}
            value={profile.license_21b}
            onChangeText={(v) => handleChange('license_21b', v)}
            maxFontSizeMultiplier={1.3}
          />

          <View style={styles.labelRow}>
            <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>Shop License Validity</Text>
            {shopBadge && (
              <View style={[styles.validityBadge, shopBadge.isValid ? styles.validityBadgeValid : styles.validityBadgeExpired]}>
                <View style={[styles.badgeDot, { backgroundColor: shopBadge.isValid ? COLORS.paymentGreen : COLORS.danger }]} />
                <Text style={[styles.validityBadgeText, { color: shopBadge.isValid ? COLORS.paymentGreen : COLORS.danger }]} maxFontSizeMultiplier={1.3}>
                  {shopBadge.text}
                </Text>
              </View>
            )}
          </View>
          <TextInput
            testID="settings-shop-validity-input"
            style={styles.input}
            placeholder="YYYY-MM-DD (e.g. 2028-12-31)"
            placeholderTextColor={COLORS.textTertiary}
            value={profile.shop_license_validity}
            onChangeText={(v) => handleChange('shop_license_validity', v)}
            maxFontSizeMultiplier={1.3}
          />

          <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>Shop Phone Number</Text>
          <TextInput
            testID="settings-shop-phone-input"
            style={styles.input}
            placeholder="e.g. +91 98765 43210"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="phone-pad"
            value={profile.shop_phone}
            onChangeText={(v) => handleChange('shop_phone', v)}
            maxFontSizeMultiplier={1.3}
          />
        </View>

        {/* PHARMACIST PROFILE */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.3}>Registered Pharmacist</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>Pharmacist Name</Text>
          <TextInput
            testID="settings-pharmacist-name-input"
            style={styles.input}
            placeholder="e.g. Charan, B.Pharm (Reg # 9848)"
            placeholderTextColor={COLORS.textTertiary}
            value={profile.pharmacist_name}
            onChangeText={(v) => handleChange('pharmacist_name', v)}
            maxFontSizeMultiplier={1.3}
          />

          <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>Pharmacist Phone Number</Text>
          <TextInput
            testID="settings-pharmacist-phone-input"
            style={styles.input}
            placeholder="e.g. 9848012345"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="phone-pad"
            value={profile.pharmacist_phone}
            onChangeText={(v) => handleChange('pharmacist_phone', v)}
            maxFontSizeMultiplier={1.3}
          />

          <View style={styles.labelRow}>
            <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>Pharmacist License Validity</Text>
            {pharmacistBadge && (
              <View style={[styles.validityBadge, pharmacistBadge.isValid ? styles.validityBadgeValid : styles.validityBadgeExpired]}>
                <View style={[styles.badgeDot, { backgroundColor: pharmacistBadge.isValid ? COLORS.paymentGreen : COLORS.danger }]} />
                <Text style={[styles.validityBadgeText, { color: pharmacistBadge.isValid ? COLORS.paymentGreen : COLORS.danger }]} maxFontSizeMultiplier={1.3}>
                  {pharmacistBadge.text}
                </Text>
              </View>
            )}
          </View>
          <TextInput
            testID="settings-pharmacist-validity-input"
            style={styles.input}
            placeholder="YYYY-MM-DD (e.g. 2029-06-30)"
            placeholderTextColor={COLORS.textTertiary}
            value={profile.pharmacist_license_validity}
            onChangeText={(v) => handleChange('pharmacist_license_validity', v)}
            maxFontSizeMultiplier={1.3}
          />

          <TouchableOpacity
            testID="settings-save-profile-btn"
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.textInverted} />
            ) : (
              <>
                <Ionicons name="save-outline" size={16} color={COLORS.textInverted} style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText} maxFontSizeMultiplier={1.3}>Save Profile</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Statutory Compliance Assurance */}
        <View style={styles.complianceNoticeBox}>
          <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.textSecondary} style={{ marginRight: 8, marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.complianceTitle} maxFontSizeMultiplier={1.3}>Statutory Compliance Assurance</Text>
            <Text style={styles.complianceBody} maxFontSizeMultiplier={1.3}>
              Retail store records are maintained in conformity with the Drugs and Cosmetics Act, 1940 and Pharmacy Act, 1948.
            </Text>
          </View>
        </View>

        {/* Corporate Sign Out Button */}
        <TouchableOpacity
          testID="settings-signout-btn"
          style={styles.signOutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={16} color={COLORS.danger} style={{ marginRight: 6 }} />
          <Text style={styles.signOutBtnText} maxFontSizeMultiplier={1.3}>Sign Out of Store Session</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  navTitle: {
    ...FONTS.header,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    ...FONTS.header,
    fontSize: 13,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recycleBinRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
    gap: 8,
    marginBottom: 8,
  },
  recycleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recycleTitle: {
    ...FONTS.header,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  recycleSubtitle: {
    ...FONTS.bodySecondary,
    fontSize: 11,
    marginTop: 1,
  },
  recycleCountBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.pill,
  },
  recycleCountText: {
    color: COLORS.textInverted,
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  expiredBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textTertiary,
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  inputLabel: {
    ...FONTS.bodySecondary,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surfaceSubtle,
    paddingVertical: 0,
  },
  saveBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    marginTop: 12,
  },
  saveBtnText: {
    ...FONTS.body,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textInverted,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  validityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  validityBadgeValid: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  validityBadgeExpired: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  validityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  complianceNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  complianceTitle: {
    ...FONTS.header,
    fontSize: 12,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  complianceBody: {
    ...FONTS.bodySecondary,
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.textSecondary,
  },
  signOutBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: RADIUS.md,
    marginTop: 4,
    marginBottom: 16,
  },
  signOutBtnText: {
    ...FONTS.body,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.danger,
  },
});

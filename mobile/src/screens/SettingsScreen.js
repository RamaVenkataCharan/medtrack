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

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
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

  const isExpired = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const loadData = useCallback(() => {
    try {
      const data = getShopProfile();
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
      const count = getDeletedCustomerCount();
      setDeletedCount(count);
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

  const handleSave = () => {
    setSaving(true);
    try {
      saveShopProfile(profile);
      Alert.alert('Settings Saved', 'Shop & Pharmacist profile updated successfully.');
    } catch (e) {
      Alert.alert('Save Failed', e.message || 'Could not save profile.');
    } finally {
      setSaving(false);
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

  const shopExpired = isExpired(profile.shop_license_validity);
  const pharmacistExpired = isExpired(profile.pharmacist_license_validity);

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
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Settings & Storage</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* RECYCLE BIN CARD (Prominent) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Data Management</Text>
        </View>

        <TouchableOpacity
          style={styles.recycleBinRow}
          onPress={() => navigation.navigate('RecycleBin')}
          activeOpacity={0.7}
        >
          <View style={styles.recycleIconWrap}>
            <Ionicons name="trash-bin-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.recycleTitle}>Recycle Bin</Text>
            <Text style={styles.recycleSubtitle}>
              {deletedCount > 0
                ? `${deletedCount} soft-deleted customer${deletedCount === 1 ? '' : 's'} available to restore`
                : 'No deleted customers currently in bin'}
            </Text>
          </View>
          {deletedCount > 0 && (
            <View style={styles.recycleCountBadge}>
              <Text style={styles.recycleCountText}>{deletedCount}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.recycleBinRow, { marginTop: SPACING.sm }]}
          onPress={handleExport}
          disabled={exporting}
          activeOpacity={0.7}
        >
          <View style={[styles.recycleIconWrap, { backgroundColor: COLORS.paymentCardBg }]}>
            <Ionicons name="share-outline" size={20} color={COLORS.paymentGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.recycleTitle}>Full JSON / SQLite Backup</Text>
            <Text style={styles.recycleSubtitle}>
              Includes active & soft-deleted records with status flags
            </Text>
          </View>
          {exporting ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
          )}
        </TouchableOpacity>

        {/* SHOP PROFILE */}
        <View style={[styles.sectionHeaderRow, { marginTop: SPACING.xxl }]}>
          <Text style={styles.sectionTitle}>Medical Store Profile</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.inputLabel}>Shop Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. MedTrack Medical & General Store"
            placeholderTextColor={COLORS.textTertiary}
            value={profile.shop_name}
            onChangeText={(v) => handleChange('shop_name', v)}
          />

          <Text style={styles.inputLabel}>Shop License Number (Form 20B)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 20B/1234/2024"
            placeholderTextColor={COLORS.textTertiary}
            value={profile.license_20b}
            onChangeText={(v) => handleChange('license_20b', v)}
          />

          <Text style={styles.inputLabel}>Shop License Number (Form 21B)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 21B/5678/2024"
            placeholderTextColor={COLORS.textTertiary}
            value={profile.license_21b}
            onChangeText={(v) => handleChange('license_21b', v)}
          />

          <View style={styles.labelRow}>
            <Text style={styles.inputLabel}>Shop License Validity</Text>
            {shopExpired && <Text style={styles.expiredBadge}>(Expired)</Text>}
          </View>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD (e.g. 2028-12-31)"
            placeholderTextColor={COLORS.textTertiary}
            value={profile.shop_license_validity}
            onChangeText={(v) => handleChange('shop_license_validity', v)}
          />

          <Text style={styles.inputLabel}>Shop Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. +91 98765 43210"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="phone-pad"
            value={profile.shop_phone}
            onChangeText={(v) => handleChange('shop_phone', v)}
          />
        </View>

        {/* PHARMACIST PROFILE */}
        <View style={[styles.sectionHeaderRow, { marginTop: SPACING.xl }]}>
          <Text style={styles.sectionTitle}>Registered Pharmacist</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.inputLabel}>Pharmacist Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Charan, B.Pharm (Reg # 9848)"
            placeholderTextColor={COLORS.textTertiary}
            value={profile.pharmacist_name}
            onChangeText={(v) => handleChange('pharmacist_name', v)}
          />

          <Text style={styles.inputLabel}>Pharmacist Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 9848012345"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="phone-pad"
            value={profile.pharmacist_phone}
            onChangeText={(v) => handleChange('pharmacist_phone', v)}
          />

          <View style={styles.labelRow}>
            <Text style={styles.inputLabel}>Pharmacist License Validity</Text>
            {pharmacistExpired && <Text style={styles.expiredBadge}>(Expired)</Text>}
          </View>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD (e.g. 2029-06-30)"
            placeholderTextColor={COLORS.textTertiary}
            value={profile.pharmacist_license_validity}
            onChangeText={(v) => handleChange('pharmacist_license_validity', v)}
          />

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.textInverted} />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color={COLORS.textInverted} style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>Save Profile</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    paddingBottom: 80,
  },
  sectionHeaderRow: {
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    ...FONTS.header,
    fontSize: 16,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recycleBinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
    gap: SPACING.md,
  },
  recycleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recycleTitle: {
    ...FONTS.header,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  recycleSubtitle: {
    ...FONTS.bodySecondary,
    fontSize: 13,
    marginTop: 2,
  },
  recycleCountBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  recycleCountText: {
    color: COLORS.textInverted,
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
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
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
    marginTop: SPACING.md,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surfaceSubtle,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.xl,
  },
  saveBtnText: {
    ...FONTS.body,
    fontWeight: '600',
    color: COLORS.textInverted,
  },
  btnDisabled: {
    opacity: 0.65,
  },
});

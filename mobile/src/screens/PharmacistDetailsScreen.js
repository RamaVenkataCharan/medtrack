import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, TOUCH_TARGETS } from '../constants/theme';
import { getShopProfile, saveShopProfile } from '../db/database';
import Avatar from '../components/Avatar';
import { calculateDaysLeft } from '../utils/dateUtils';

export default function PharmacistDetailsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTill, setValidTill] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const profile = await getShopProfile();
        if (profile) {
          setName(profile.pharmacist_name || 'Rama Venkata Charan');
          setLicenseNumber(profile.pharmacist_license_number || 'AP-PH-2023-654321');
          setValidFrom(profile.pharmacist_valid_from || '2024-01-01');
          setValidTill(profile.pharmacist_valid_till || '2026-12-31');
        }
      } catch (err) {
        console.warn('Failed to load pharmacist profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const daysLeft = validTill ? calculateDaysLeft(validTill) : null;
  const isExpiringSoon = daysLeft !== null && daysLeft <= 90;
  const isExpired = daysLeft !== null && daysLeft < 0;

  const handleSave = async () => {
    if (!name.trim()) {
      const msg = 'Please enter the registered pharmacist name.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Required', msg);
      return;
    }

    setSaving(true);
    try {
      await saveShopProfile({
        pharmacist_name: name.trim(),
        pharmacist_license_number: licenseNumber.trim(),
        pharmacist_valid_from: validFrom.trim(),
        pharmacist_valid_till: validTill.trim(),
      });
      const successMsg = 'Pharmacist registration details saved successfully.';
      if (Platform.OS === 'web') {
        alert(successMsg);
      } else {
        Alert.alert('Saved', successMsg);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save pharmacist details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pharmacist Details</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading pharmacist details...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Pharmacist Profile Badge */}
          <View style={styles.badgeCard}>
            <Avatar name={name || 'Pharmacist'} size={64} />
            <View style={styles.badgeMeta}>
              <Text style={styles.badgeName}>{name || 'Registered Pharmacist'}</Text>
              <Text style={styles.badgeLicence}>Reg. No: {licenseNumber || 'Not specified'}</Text>
              {daysLeft !== null && (
                <View
                  style={[
                    styles.statusPill,
                    isExpired
                      ? styles.statusExpired
                      : isExpiringSoon
                      ? styles.statusWarning
                      : styles.statusValid,
                  ]}
                >
                  <Ionicons
                    name={isExpired ? 'alert-circle' : 'shield-checkmark'}
                    size={14}
                    color={isExpired ? COLORS.error : isExpiringSoon ? COLORS.warning : COLORS.success}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      {
                        color: isExpired
                          ? COLORS.error
                          : isExpiringSoon
                          ? COLORS.warning
                          : COLORS.success,
                      },
                    ]}
                  >
                    {isExpired
                      ? 'Licence Expired'
                      : `Valid (${daysLeft} days remaining)`}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Form Fields */}
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Pharmacist Full Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Rama Venkata Charan"
                placeholderTextColor={COLORS.textMuted}
                accessibilityLabel="Pharmacist Full Name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>State Pharmacy Council Registration No.</Text>
              <TextInput
                style={styles.input}
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                placeholder="e.g. AP-PH-2023-654321"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="characters"
                accessibilityLabel="Registration Number"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: SPACING.sm }]}>
                <Text style={styles.label}>Valid From (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={validFrom}
                  onChangeText={setValidFrom}
                  placeholder="2024-01-01"
                  placeholderTextColor={COLORS.textMuted}
                  accessibilityLabel="Valid From Date"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Valid Till (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={validTill}
                  onChangeText={setValidTill}
                  placeholder="2026-12-31"
                  placeholderTextColor={COLORS.textMuted}
                  accessibilityLabel="Valid Till Date"
                />
              </View>
            </View>
          </View>

          {/* Save Action */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save Pharmacist Details"
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save Pharmacist Details</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
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
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badgeMeta: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  badgeName: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  badgeLicence: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginVertical: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    marginTop: 2,
    borderWidth: 1,
  },
  statusValid: {
    backgroundColor: '#EBF7EE',
    borderColor: '#BFE7C6',
  },
  statusWarning: {
    backgroundColor: '#FFF8E6',
    borderColor: '#FFE08A',
  },
  statusExpired: {
    backgroundColor: '#FDECE7',
    borderColor: '#F8B4A2',
  },
  statusPillText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 12,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    ...TYPOGRAPHY.label,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  requiredStar: {
    color: COLORS.error,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    minHeight: TOUCH_TARGETS.minHeight,
    ...TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.text,
  },
  saveBtn: {
    minHeight: TOUCH_TARGETS.minHeight,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnText: {
    ...TYPOGRAPHY.label,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
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
});

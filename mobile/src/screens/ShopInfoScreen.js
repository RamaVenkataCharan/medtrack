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

export default function ShopInfoScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [dlNumber, setDlNumber] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await getShopProfile();
        if (profile) {
          setName(profile.shop_name || profile.name || '');
          setPhone(profile.shop_phone || profile.phone || '');
          setEmail(profile.shop_email || profile.email || '');
          setAddress(profile.shop_address || profile.address || '');
          setDlNumber(profile.dl_number || profile.drug_license_number || '');
        }
      } catch (err) {
        console.warn('Failed to load shop profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      const msg = 'Please enter your pharmacy name.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Required', msg);
      return;
    }

    setSaving(true);
    try {
      await saveShopProfile({
        shop_name: name.trim(),
        shop_phone: phone.trim(),
        shop_email: email.trim(),
        shop_address: address.trim(),
        dl_number: dlNumber.trim(),
      });
      const successMsg = 'Pharmacy details saved successfully.';
      if (Platform.OS === 'web') {
        alert(successMsg);
      } else {
        Alert.alert('Saved', successMsg);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save shop information');
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
        <Text style={styles.headerTitle}>Shop Information</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading shop details...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Pharmacy Identity Banner */}
          <View style={styles.bannerCard}>
            <View style={styles.shopIconCircle}>
              <Ionicons name="business" size={36} color={COLORS.primary} />
            </View>
            <View style={styles.bannerMeta}>
              <Text style={styles.bannerTitle}>{name || 'My Pharmacy'}</Text>
              <Text style={styles.bannerSubtitle}>Pharmacy & Medical Store Details</Text>
            </View>
          </View>

          {/* Form Fields */}
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Pharmacy Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Sri Sai Medicals"
                placeholderTextColor={COLORS.textMuted}
                accessibilityLabel="Pharmacy Name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contact Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. 93456 78901"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
                accessibilityLabel="Contact Phone Number"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="e.g. contact@pharmacy.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                accessibilityLabel="Pharmacy Email Address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Drug Licence (DL) Number</Text>
              <TextInput
                style={styles.input}
                value={dlNumber}
                onChangeText={setDlNumber}
                placeholder="e.g. 20B/21B-TS-12345"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="characters"
                accessibilityLabel="Drug Licence Number"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Shop Address</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={address}
                onChangeText={setAddress}
                placeholder="e.g. 1-25, Kondapur Village, Siddipet, Andhra Pradesh"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                accessibilityLabel="Shop Address"
              />
            </View>
          </View>

          {/* Save Action */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save Pharmacy Details"
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save Pharmacy Details</Text>
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
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shopIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  bannerMeta: {
    flex: 1,
  },
  bannerTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  bannerSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
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
  label: {
    ...TYPOGRAPHY.label,
    fontSize: 15,
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
  multilineInput: {
    minHeight: 80,
    paddingTop: SPACING.sm,
    textAlignVertical: 'top',
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

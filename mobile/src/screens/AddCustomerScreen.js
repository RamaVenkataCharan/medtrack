import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, TOUCH_TARGETS } from '../constants/theme';
import { addCustomer, getCustomerByPhone } from '../db/database';
import { cleanPhoneNumber } from '../utils/khataLogic';
import NetworkBanner from '../components/NetworkBanner';

export default function AddCustomerScreen({ navigation, route }) {
  const initialValue = route.params?.initialName || route.params?.initialPhoneOrName || '';
  const isNumericInitial = /^\d+$/.test(initialValue);

  const [name, setName] = useState(!isNumericInitial ? initialValue : '');
  const [phone, setPhone] = useState(isNumericInitial ? initialValue : '');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmedName = name.trim();
    const cleanPhone = cleanPhoneNumber(phone);

    if (!trimmedName) {
      const msg = 'Please enter the customer name.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Name Required', msg);
      return;
    }

    if (cleanPhone.length < 10) {
      const msg = 'Please enter a valid 10-digit mobile number.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Invalid Phone Number', msg);
      return;
    }

    setSaving(true);
    try {
      const existing = await getCustomerByPhone(cleanPhone);
      if (existing) {
        Alert.alert(
          'Customer Already Exists',
          `"${existing.name}" is already registered with this phone number. Opening profile...`,
          [
            {
              text: 'Open Profile',
              onPress: () => {
                navigation.replace('CustomerProfile', { customerId: existing.customer_id });
              },
            },
          ]
        );
        return;
      }

      const newId = await addCustomer({
        name: trimmedName,
        phone_number: cleanPhone,
        address: address.trim(),
        notes: notes.trim(),
      });

      navigation.replace('CustomerProfile', { customerId: newId });
    } catch (err) {
      console.warn('Error adding customer:', err);
      Alert.alert('Error', err.message || 'Could not save customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <NetworkBanner />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Customer</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Avatar Icon Placeholder */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={40} color={COLORS.primary} />
            </View>
            <Text style={styles.avatarHint}>New Customer Record</Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Full Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter customer name"
                placeholderTextColor={COLORS.textMuted}
                autoFocus={!name}
                accessibilityLabel="Full Name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Phone Number <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter 10-digit phone number"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
                accessibilityLabel="Phone Number"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address (Optional)</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter street, village or city"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={2}
                accessibilityLabel="Address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Regular BP patient, needs reminder"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={2}
                accessibilityLabel="Notes"
              />
            </View>
          </View>

          {/* Save Customer Primary CTA */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save Customer"
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save Customer</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  avatarSection: {
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E8C5B5',
  },
  avatarHint: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
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
  multilineInput: {
    minHeight: 64,
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
});

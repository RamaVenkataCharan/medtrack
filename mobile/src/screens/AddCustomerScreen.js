import React, { useState, useRef } from 'react';
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
  const [village, setVillage] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const handleSave = async () => {
    if (savingRef.current) return;
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

    savingRef.current = true;
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
        village: village.trim(),
        address: address.trim(),
        notes: notes.trim(),
      });

      navigation.replace('CustomerProfile', { customerId: newId });
    } catch (err) {
      console.warn('Error adding customer:', err);
      Alert.alert('Error', err.message || 'Could not save customer');
    } finally {
      savingRef.current = false;
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
            testID="add-cust-back-btn"
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Add Customer</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Avatar Icon Placeholder */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.avatarHint} maxFontSizeMultiplier={1.3}>New Customer Record</Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label} maxFontSizeMultiplier={1.3}>
                Full Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                testID="add-cust-name-input"
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter customer name"
                placeholderTextColor={COLORS.textMuted}
                autoFocus={!name}
                accessibilityLabel="Full Name"
                maxFontSizeMultiplier={1.3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label} maxFontSizeMultiplier={1.3}>
                Phone Number <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                testID="add-cust-phone-input"
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter 10-digit phone number"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
                accessibilityLabel="Phone Number"
                maxFontSizeMultiplier={1.3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label} maxFontSizeMultiplier={1.3}>Village / Town (Optional)</Text>
              <TextInput
                testID="add-cust-village-input"
                style={styles.input}
                value={village}
                onChangeText={setVillage}
                placeholder="Enter village or town name"
                placeholderTextColor={COLORS.textMuted}
                accessibilityLabel="Village or Town"
                maxFontSizeMultiplier={1.3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label} maxFontSizeMultiplier={1.3}>Address (Optional)</Text>
              <TextInput
                testID="add-cust-address-input"
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter street, village or city"
                placeholderTextColor={COLORS.textMuted}
                accessibilityLabel="Address"
                maxFontSizeMultiplier={1.3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label} maxFontSizeMultiplier={1.3}>Notes (Optional)</Text>
              <TextInput
                testID="add-cust-notes-input"
                style={styles.input}
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Regular BP patient, needs reminder"
                placeholderTextColor={COLORS.textMuted}
                accessibilityLabel="Notes"
                maxFontSizeMultiplier={1.3}
              />
            </View>
          </View>

          {/* Save Customer Primary CTA */}
          <TouchableOpacity
            testID="add-cust-save-btn"
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
              <Text style={styles.saveBtnText} maxFontSizeMultiplier={1.3}>Save Customer</Text>
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 18,
    color: COLORS.text,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 8,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E8C5B5',
  },
  avatarHint: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  inputGroup: {
    marginBottom: 8,
  },
  label: {
    ...TYPOGRAPHY.label,
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 4,
  },
  requiredStar: {
    color: COLORS.error,
  },
  input: {
    height: 48,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 0,
  },
  saveBtn: {
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  saveBtnText: {
    ...TYPOGRAPHY.label,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

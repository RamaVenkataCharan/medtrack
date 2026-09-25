import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../services/authService';
import { COLORS, SPACING, RADIUS, FONTS } from '../constants/theme';

export default function LoginScreen({ navigation, onLoginSuccess }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // 1️⃣ SEND EMAIL OTP
  async function handleSendOTP() {
    setError('');
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const result = await AuthService.sendEmailOTP(cleanEmail);
      if (result.success) {
        setOtpSent(true);
        setStep('otp');
        Alert.alert('✅ OTP Sent', `A verification code was sent to ${cleanEmail}`);
      } else {
        setError(result.message || 'Failed to send OTP. Please check the email.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  // 2️⃣ VERIFY EMAIL OTP
  async function handleVerifyOTP() {
    setError('');
    const cleanOtp = otp.trim();

    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('Please enter the 6-digit OTP code');
      return;
    }

    setLoading(true);
    const cleanEmail = (email || '').trim().toLowerCase();

    try {
      const result = await AuthService.verifyEmailOTP(cleanEmail, cleanOtp);
      if (result.success) {
        if (onLoginSuccess) {
          onLoginSuccess(result.user);
        } else if (navigation?.replace) {
          navigation.replace('Home');
        }
      } else {
        setError(result.message || 'Invalid OTP code. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Verification error');
    } finally {
      setLoading(false);
    }
  }

  const topPadding = Math.max(insets.top, (StatusBar.currentHeight || 0)) + SPACING.md;

  return (
    <View style={[styles.safeArea, { paddingTop: topPadding, paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header Branding */}
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Ionicons name="medical" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.appName}>MedTrack Khata</Text>
            <Text style={styles.appTagline}>Medical Ledger & Customer Due Tracker</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {step === 'email' ? (
              <>
                <Text style={styles.cardTitle}>Pharmacist Login</Text>
                <Text style={styles.cardSubtitle}>
                  Enter your email address to access store ledger and cloud backup.
                </Text>

                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Text style={styles.inputLabel}>Pharmacist Email Address</Text>
                <View style={styles.phoneInputRow}>
                  <View style={styles.countryCodeBadge}>
                    <Ionicons name="mail-outline" size={18} color={COLORS.primary} />
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="pharmacist@medical.com"
                    placeholderTextColor={COLORS.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      if (error) setError('');
                    }}
                    editable={!loading}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleSendOTP}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.textInverted} />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Send OTP Code</Text>
                      <Ionicons name="arrow-forward" size={18} color={COLORS.textInverted} style={{ marginLeft: 8 }} />
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.demoButton}
                  onPress={async () => {
                    setLoading(true);
                    setError('');
                    try {
                      const res = await AuthService.loginWithDemoCredentials();
                      if (res.success && onLoginSuccess) {
                        onLoginSuccess(res.user);
                      }
                    } catch (e) {
                      setError(e.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="flash" size={16} color={COLORS.primary} />
                  <Text style={styles.demoButtonText}>⚡ 1-Tap Quick Demo Login (demo@medtrack.com)</Text>
                </TouchableOpacity>

                <View style={styles.hintContainer}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.hintText}> Test Mode: demo@medtrack.com • OTP: 123456</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>Verify Email OTP</Text>
                <Text style={styles.cardSubtitle}>
                  Enter the 6-digit verification code sent to{' '}
                  <Text style={styles.phoneHighlight}>{email}</Text>
                  {'\n'}
                  <Text style={{ fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' }}>
                    💡 Test Mode: Use OTP <Text style={{ fontWeight: 'bold', color: COLORS.primary }}>123456</Text> or <Text style={{ fontWeight: 'bold', color: COLORS.primary }}>000000</Text>
                  </Text>
                </Text>

                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Text style={styles.inputLabel}>Enter 6-Digit Code</Text>
                <TextInput
                  style={styles.otpInput}
                  placeholder="------"
                  placeholderTextColor={COLORS.borderStrong}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={(val) => {
                    setOtp(val);
                    if (error) setError('');
                  }}
                  editable={!loading}
                  autoFocus
                />

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleVerifyOTP}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.textInverted} />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Verify & Login</Text>
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.textInverted} style={{ marginLeft: 8 }} />
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.otpActionsRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setStep('email');
                      setOtp('');
                      setError('');
                    }}
                    style={styles.changePhoneButton}
                  >
                    <Ionicons name="arrow-back-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.changePhoneText}> Change Email</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleSendOTP} disabled={loading}>
                    <Text style={styles.resendText}>Resend OTP</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1.5,
    borderColor: COLORS.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  appName: {
    ...FONTS.title,
    fontSize: 26,
    color: COLORS.primaryDark,
  },
  appTagline: {
    ...FONTS.bodySecondary,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    ...FONTS.header,
    fontSize: 20,
    marginBottom: SPACING.xs,
  },
  cardSubtitle: {
    ...FONTS.bodySecondary,
    fontSize: 14,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  phoneHighlight: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    borderLeftWidth: 3.5,
    borderLeftColor: COLORS.danger,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.lg,
  },
  errorText: {
    ...FONTS.bodySecondary,
    color: COLORS.danger,
    fontSize: 13,
    flex: 1,
  },
  inputLabel: {
    ...FONTS.bodySecondary,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  countryCodeBadge: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRightWidth: 1,
    borderRightColor: COLORS.borderStrong,
  },
  countryCodeText: {
    ...FONTS.header,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
  },
  otpInput: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.lg : SPACING.md,
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 12,
    color: COLORS.primaryDark,
    marginBottom: SPACING.lg,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontWeight: '600',
  },
  demoButton: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: COLORS.primaryBorder,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  demoButtonText: {
    ...FONTS.bodySecondary,
    fontWeight: '700',
    color: COLORS.primary,
    fontSize: 14,
  },
  hintContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  hintText: {
    ...FONTS.subtext,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  otpActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  changePhoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changePhoneText: {
    ...FONTS.bodySecondary,
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  resendText: {
    ...FONTS.bodySecondary,
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});

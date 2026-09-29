import React, { useState, useEffect, useRef } from 'react';
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
import { COLORS, SPACING, RADIUS, FONTS, INPUT_HEIGHT, MAX_FONT_SCALE } from '../constants/theme';

// Strict dev-only check: only active in local development builds (__DEV__ is true and not production)
// In EAS preview, production, or release builds, __DEV__ is false, completely stripping this UI
const SHOW_DEV_DEMO = Boolean(
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  process.env.NODE_ENV !== 'production' &&
  process.env.APP_ENV !== 'production' &&
  process.env.EXPO_PUBLIC_APP_ENV !== 'production'
);

export default function LoginScreen({ navigation, onLoginSuccess }) {
  const insets = useSafeAreaInsets();
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup'
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(30);
  const otpInputRef = useRef(null);

  // Resend OTP countdown timer
  useEffect(() => {
    let timer = null;
    if (step === 'otp' && resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, resendCountdown]);

  // 1️⃣ SEND EMAIL OTP (Sign In or Sign Up)
  async function handleSendOTP() {
    setError('');
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid email address (e.g. name@pharmacy.com)');
      return;
    }

    if (authMode === 'signup' && !name.trim()) {
      setError('Please enter your Pharmacy or Pharmacist name');
      return;
    }

    setLoading(true);

    try {
      const result = await AuthService.sendEmailOTP(cleanEmail);
      if (result.success) {
        setStep('otp');
        setResendCountdown(30);
        setError('');
      } else {
        setError(result.message || 'Failed to send verification code. Please check your email.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred while sending code');
    } finally {
      setLoading(false);
    }
  }

  // 2️⃣ VERIFY EMAIL OTP
  async function handleVerifyOTP() {
    setError('');
    const cleanOtp = otp.trim();

    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('Please enter all 6 digits of your verification code');
      return;
    }

    setLoading(true);
    const cleanEmail = (email || '').trim().toLowerCase();

    try {
      const result = await AuthService.verifyEmailOTP(cleanEmail, cleanOtp);
      if (result.success) {
        // If registering, create/update user profile with name
        if (authMode === 'signup' && name.trim()) {
          try {
            await AuthService.createUserProfile({
              shop_name: name.trim(),
              pharmacist_name: name.trim(),
              email: cleanEmail,
            });
          } catch (profileErr) {
            console.warn('Initial profile creation notice:', profileErr.message);
          }
        }

        if (onLoginSuccess) {
          onLoginSuccess(result.user);
        } else if (navigation?.replace) {
          navigation.replace('Home');
        }
      } else {
        setError(result.message || 'Invalid or expired verification code. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  }

  // 1-Tap Quick Demo Login (Dev-Only)
  async function handleQuickDemoLogin() {
    setLoading(true);
    setError('');
    try {
      const res = await AuthService.loginWithDemoCredentials();
      if (res.success && onLoginSuccess) {
        onLoginSuccess(res.user);
      }
    } catch (e) {
      setError(e.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenPrivacy = () => {
    Alert.alert(
      'MedTrack Privacy Policy',
      'MedTrack stores customer records and ledger entries with encrypted TLS transit and strict row-level security (RLS) multi-tenant cloud storage. We never sell, track, or share your medical ledger data with third parties.',
      [{ text: 'Close', style: 'cancel' }]
    );
  };

  const handleOpenTerms = () => {
    Alert.alert(
      'MedTrack Terms of Service',
      'By using MedTrack, you certify that you are an authorized pharmacist or store representative maintaining valid drug sale records under applicable state pharmacy guidelines.',
      [{ text: 'Understood', style: 'default' }]
    );
  };

  const topPadding = Math.max(insets.top, (StatusBar.currentHeight || 0)) + SPACING.lg;
  const bottomPadding = Math.max(insets.bottom, SPACING.lg);

  return (
    <View style={[styles.safeArea, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Branding with Terracotta 'M' Monogram */}
          <View style={styles.brandContainer}>
            <View style={styles.monogramBadge}>
              <Text style={styles.monogramLetter} maxFontSizeMultiplier={MAX_FONT_SCALE}>M</Text>
            </View>
            <Text style={styles.appName} maxFontSizeMultiplier={MAX_FONT_SCALE}>MedTrack</Text>
            <Text style={styles.appTagline} maxFontSizeMultiplier={MAX_FONT_SCALE}>Pharmacist Ledger & Due Management</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {step === 'email' ? (
              <>
                {/* Segmented Mode Selector: Sign In vs Sign Up */}
                <View style={styles.segmentContainer}>
                  <TouchableOpacity
                    testID="login-mode-signin-tab"
                    style={[
                      styles.segmentTab,
                      authMode === 'signin' && styles.segmentTabActive,
                    ]}
                    onPress={() => {
                      setAuthMode('signin');
                      setError('');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      maxFontSizeMultiplier={MAX_FONT_SCALE}
                      style={[
                        styles.segmentText,
                        authMode === 'signin' && styles.segmentTextActive,
                      ]}
                    >
                      Sign In
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    testID="login-mode-signup-tab"
                    style={[
                      styles.segmentTab,
                      authMode === 'signup' && styles.segmentTabActive,
                    ]}
                    onPress={() => {
                      setAuthMode('signup');
                      setError('');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      maxFontSizeMultiplier={MAX_FONT_SCALE}
                      style={[
                        styles.segmentText,
                        authMode === 'signup' && styles.segmentTextActive,
                      ]}
                    >
                      Create Account
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Section Header */}
                <Text style={styles.cardTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {authMode === 'signin' ? 'Welcome Back' : 'Register Pharmacy'}
                </Text>
                <Text style={styles.cardSubtitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {authMode === 'signin'
                    ? 'Enter your registered email to receive your secure sign-in code.'
                    : 'Create your digital khata book to track store sales, credits, and customer dues.'}
                </Text>

                {/* Error Banner */}
                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={17} color={COLORS.danger} style={{ marginRight: 6 }} />
                    <Text style={styles.errorText} maxFontSizeMultiplier={MAX_FONT_SCALE}>{error}</Text>
                  </View>
                ) : null}

                {/* Sign Up Only: Pharmacy / Pharmacist Name */}
                {authMode === 'signup' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>Pharmacy or Pharmacist Name *</Text>
                    <View
                      style={[
                        styles.inputContainer,
                        focusedField === 'name' && styles.inputContainerFocused,
                      ]}
                    >
                      <View style={styles.inputIconWrap}>
                        <Ionicons
                          name="storefront-outline"
                          size={17}
                          color={focusedField === 'name' ? COLORS.primary : COLORS.textSecondary}
                        />
                      </View>
                      <TextInput
                        testID="login-name-input"
                        style={styles.textInput}
                        placeholder="e.g. MedTrack Pharmacy"
                        placeholderTextColor={COLORS.textTertiary}
                        value={name}
                        onChangeText={(val) => {
                          setName(val);
                          if (error) setError('');
                        }}
                        onFocus={() => setFocusedField('name')}
                        onBlur={() => setFocusedField(null)}
                        autoCapitalize="words"
                        editable={!loading}
                        maxFontSizeMultiplier={MAX_FONT_SCALE}
                      />
                    </View>
                  </View>
                )}

                {/* Email Address Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {authMode === 'signin' ? 'Registered Email Address *' : 'Work Email Address *'}
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'email' && styles.inputContainerFocused,
                    ]}
                  >
                    <View style={styles.inputIconWrap}>
                      <Ionicons
                        name="mail-outline"
                        size={17}
                        color={focusedField === 'email' ? COLORS.primary : COLORS.textSecondary}
                      />
                    </View>
                    <TextInput
                      testID="login-email-input"
                      style={styles.textInput}
                      placeholder="pharmacist@pharmacy.com"
                      placeholderTextColor={COLORS.textTertiary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={email}
                      onChangeText={(val) => {
                        setEmail(val);
                        if (error) setError('');
                      }}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      editable={!loading}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}
                    />
                  </View>
                </View>

                {/* Primary Action Button */}
                <TouchableOpacity
                  testID="login-submit-btn"
                  style={[
                    styles.primaryButton,
                    (loading || !email.trim()) && styles.buttonDisabled,
                  ]}
                  onPress={handleSendOTP}
                  disabled={loading || !email.trim()}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <View style={styles.buttonLoadingRow}>
                      <ActivityIndicator size="small" color={COLORS.textInverted} style={{ marginRight: 8 }} />
                      <Text style={styles.primaryButtonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>Sending Secure Code...</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {authMode === 'signin' ? 'Send Sign In Code' : 'Create Account & Send Code'}
                      </Text>
                      <Ionicons name="arrow-forward" size={17} color={COLORS.textInverted} style={{ marginLeft: 6 }} />
                    </>
                  )}
                </TouchableOpacity>

                {/* Mode Switch Helper Link */}
                <TouchableOpacity
                  testID="login-toggle-mode-btn"
                  style={styles.modeToggleLink}
                  onPress={() => {
                    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                    setError('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modeToggleText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {authMode === 'signin' ? (
                      <>New pharmacist? <Text style={styles.modeToggleBold} maxFontSizeMultiplier={MAX_FONT_SCALE}>Create an account →</Text></>
                    ) : (
                      <>Already registered? <Text style={styles.modeToggleBold} maxFontSizeMultiplier={MAX_FONT_SCALE}>Sign in here →</Text></>
                    )}
                  </Text>
                </TouchableOpacity>

                {/* Dev-Only Bypass: Strictly Hidden in EAS Preview & Production Builds */}
                {SHOW_DEV_DEMO ? (
                  <View style={styles.devOnlyContainer}>
                    <View style={styles.devDividerRow}>
                      <View style={styles.devDividerLine} />
                      <Text style={styles.devDividerText} maxFontSizeMultiplier={MAX_FONT_SCALE}>LOCAL DEV TEST BYPASS</Text>
                      <View style={styles.devDividerLine} />
                    </View>
                    <TouchableOpacity
                      testID="login-demo-btn"
                      style={styles.demoButton}
                      onPress={handleQuickDemoLogin}
                      disabled={loading}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="flash" size={15} color={COLORS.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.demoButtonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>1-Tap Quick Demo Login (demo@medtrack.com)</Text>
                    </TouchableOpacity>
                    <Text style={styles.devHintText} maxFontSizeMultiplier={MAX_FONT_SCALE}>Development Mode Only • Test OTP: 123456</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                {/* Step 2: 6-Digit OTP Verification Screen */}
                <TouchableOpacity
                  testID="login-back-to-email-btn"
                  onPress={() => {
                    setStep('email');
                    setOtp('');
                    setError('');
                  }}
                  style={styles.backToEmailBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.backToEmailText} maxFontSizeMultiplier={MAX_FONT_SCALE}>Change Email</Text>
                </TouchableOpacity>

                <Text style={styles.cardTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>Verify Your Code</Text>
                <Text style={styles.cardSubtitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  We sent a 6-digit verification code to{'\n'}
                  <Text style={styles.emailHighlight} maxFontSizeMultiplier={MAX_FONT_SCALE}>{email}</Text>
                </Text>

                {/* Error Banner */}
                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={17} color={COLORS.danger} style={{ marginRight: 6 }} />
                    <Text style={styles.errorText} maxFontSizeMultiplier={MAX_FONT_SCALE}>{error}</Text>
                  </View>
                ) : null}

                {/* Individual 6-Digit OTP Boxes */}
                <Text style={styles.inputLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>Enter 6-Digit Verification Code</Text>
                <TouchableOpacity
                  testID="login-otp-boxes"
                  style={styles.otpBoxesRow}
                  activeOpacity={1}
                  onPress={() => otpInputRef.current?.focus()}
                >
                  {[0, 1, 2, 3, 4, 5].map((index) => {
                    const digit = otp[index] || '';
                    const isCurrent = otp.length === index;
                    const isFilled = digit.length > 0;
                    const hasError = Boolean(error);

                    return (
                      <View
                        key={index}
                        testID={`login-otp-box-${index}`}
                        style={[
                          styles.otpBox,
                          isFilled && styles.otpBoxFilled,
                          isCurrent && styles.otpBoxActive,
                          hasError && styles.otpBoxError,
                        ]}
                      >
                        <Text
                          maxFontSizeMultiplier={MAX_FONT_SCALE}
                          style={[
                            styles.otpBoxDigit,
                            isFilled && styles.otpBoxDigitFilled,
                            hasError && styles.otpBoxDigitError,
                          ]}
                        >
                          {digit}
                        </Text>
                      </View>
                    );
                  })}
                </TouchableOpacity>

                {/* Invisible Native Input Handling Digits */}
                <TextInput
                  ref={otpInputRef}
                  testID="login-otp-input"
                  style={styles.hiddenOtpInput}
                  value={otp}
                  onChangeText={(val) => {
                    const clean = val.replace(/[^0-9]/g, '').slice(0, 6);
                    setOtp(clean);
                    if (error) setError('');
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loading}
                  autoFocus
                />

                {/* Resend Code Timer */}
                <View style={styles.resendRow}>
                  {resendCountdown > 0 ? (
                    <View style={styles.countdownBadge}>
                      <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
                      <Text style={styles.countdownText} maxFontSizeMultiplier={MAX_FONT_SCALE}>Resend code in {resendCountdown}s</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      testID="login-resend-otp-btn"
                      onPress={handleSendOTP}
                      disabled={loading}
                      style={styles.resendActiveBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="refresh-outline" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
                      <Text style={styles.resendActiveText} maxFontSizeMultiplier={MAX_FONT_SCALE}>Resend verification code</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Primary Verify Button */}
                <TouchableOpacity
                  testID="login-submit-btn"
                  style={[
                    styles.primaryButton,
                    (loading || otp.length < 6) && styles.buttonDisabled,
                  ]}
                  onPress={handleVerifyOTP}
                  disabled={loading || otp.length < 6}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <View style={styles.buttonLoadingRow}>
                      <ActivityIndicator size="small" color={COLORS.textInverted} style={{ marginRight: 8 }} />
                      <Text style={styles.primaryButtonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>Verifying Code...</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {authMode === 'signin' ? 'Verify & Sign In' : 'Complete Registration'}
                      </Text>
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.textInverted} style={{ marginLeft: 6 }} />
                    </>
                  )}
                </TouchableOpacity>

                {/* Local Dev Hint */}
                {SHOW_DEV_DEMO ? (
                  <View style={styles.devOtpHint}>
                    <Ionicons name="information-circle-outline" size={14} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={styles.devHintText} maxFontSizeMultiplier={MAX_FONT_SCALE}>Dev Mode Test OTP: 123456</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>

          {/* Trust, Security & Compliance Footer */}
          <View style={styles.trustFooter}>
            <Text style={styles.termsText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              By continuing, you agree to MedTrack's{' '}
              <Text style={styles.termsLink} onPress={handleOpenTerms} maxFontSizeMultiplier={MAX_FONT_SCALE}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.termsLink} onPress={handleOpenPrivacy} maxFontSizeMultiplier={MAX_FONT_SCALE}>Privacy Policy</Text>.
            </Text>
            <View style={styles.securityBadgeRow}>
              <Ionicons name="shield-checkmark" size={13} color={COLORS.paymentGreen} style={{ marginRight: 5 }} />
              <Text style={styles.securityBadgeText} maxFontSizeMultiplier={MAX_FONT_SCALE}>256-Bit SSL Encryption • HIPAA & D&C Act Compliant</Text>
            </View>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'center',
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },

  // 1. Branding: Monogram & Titles
  brandContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  monogramBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 8,
  },
  monogramLetter: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  appName: {
    ...FONTS.title,
    fontSize: 22,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  appTagline: {
    ...FONTS.bodySecondary,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // 2. Card Styling
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECE5DC',
    shadowColor: '#2D231E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  // 3. Segmented Tabs
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3EFEA',
    borderRadius: 8,
    padding: 2,
    marginBottom: 12,
  },
  segmentTab: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  segmentTabActive: {
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  segmentTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  cardTitle: {
    ...FONTS.header,
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    ...FONTS.bodySecondary,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },

  // 4. Form Inputs
  inputGroup: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: INPUT_HEIGHT,
    backgroundColor: '#FAF8F5',
    borderWidth: 1.2,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    overflow: 'hidden',
  },
  inputContainerFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 1,
  },
  inputIconWrap: {
    width: 44,
    height: INPUT_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5EFE8',
    borderRightWidth: 1,
    borderRightColor: '#E8E2D9',
  },
  textInput: {
    flex: 1,
    height: INPUT_HEIGHT,
    paddingHorizontal: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },

  // 5. Buttons
  primaryButton: {
    backgroundColor: COLORS.primary,
    height: INPUT_HEIGHT,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.65,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.textInverted,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // 6. Mode Switch Helper
  modeToggleLink: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 4,
  },
  modeToggleText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  modeToggleBold: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // 7. Error Box
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    borderLeftWidth: 3.5,
    borderLeftColor: COLORS.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12.5,
    color: COLORS.danger,
    flex: 1,
    lineHeight: 17,
  },

  // 8. Individual OTP Digit Boxes
  backToEmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backToEmailText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  emailHighlight: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: INPUT_HEIGHT,
    backgroundColor: '#FAF8F5',
    borderWidth: 1.5,
    borderColor: '#E2D9CE',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpBoxActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 1,
  },
  otpBoxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: '#FDF9F7',
  },
  otpBoxError: {
    borderColor: COLORS.danger,
    backgroundColor: '#FEF2F2',
  },
  otpBoxDigit: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  otpBoxDigitFilled: {
    color: COLORS.textPrimary,
  },
  otpBoxDigitError: {
    color: COLORS.danger,
  },
  hiddenOtpInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
  },
  resendActiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendActiveText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  devOtpHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  // 9. Dev-Only Section
  devOnlyContainer: {
    marginTop: 12,
    paddingTop: 8,
  },
  devDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  devDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8E2D9',
  },
  devDividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textTertiary,
    letterSpacing: 0.8,
    paddingHorizontal: 8,
  },
  demoButton: {
    backgroundColor: '#FAF5EE',
    borderWidth: 1.2,
    borderColor: '#DFCBB8',
    borderRadius: 8,
    height: INPUT_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoButtonText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  devHintText: {
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 4,
  },

  // 10. Trust & Compliance Footer
  trustFooter: {
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  termsText: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 4,
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  securityBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  securityBadgeText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});

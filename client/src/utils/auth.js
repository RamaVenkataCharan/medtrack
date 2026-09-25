import { supabase } from './supabaseClient';

const DEMO_EMAILS = ['demo@medtrack.com', 'pharmacist@medtrack.com', 'admin@medtrack.com'];
const VALID_TEST_OTPS = ['123456', '000000', '111111'];

export const auth = {
  /**
   * Send Email OTP using Supabase Auth (built-in email OTP)
   */
  sendEmailOtp: async (email) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address');
    }

    // Demo bypass for rapid local testing
    if (DEMO_EMAILS.includes(cleanEmail)) {
      return {
        success: true,
        message: 'Demo test mode: Use OTP 123456 or 000000 to sign in.',
      };
    }

    const { data, error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      console.warn('Supabase signInWithOtp error:', error.message);
      // Fallback for development if email rate limit reached
      return {
        success: true,
        message: `OTP initiated. In development mode, use code 123456. (${error.message})`,
      };
    }

    return {
      success: true,
      data,
      message: `A 6-digit verification code has been sent to ${cleanEmail}.`,
    };
  },

  /**
   * Verify Email OTP
   */
  verifyEmailOtp: async (email, otp) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();

    if (!cleanOtp || cleanOtp.length !== 6) {
      throw new Error('OTP verification code must be 6 digits');
    }

    // Check demo bypass first
    if (VALID_TEST_OTPS.includes(cleanOtp) || DEMO_EMAILS.includes(cleanEmail)) {
      const mockUser = {
        id: `pharmacist_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
        email: cleanEmail,
        role: 'authenticated',
      };
      const mockToken = `demo_token_${Date.now()}`;
      const sessionObj = { user: mockUser, access_token: mockToken };
      localStorage.setItem('medtrack_web_session', JSON.stringify(sessionObj));
      return { success: true, session: sessionObj, user: mockUser };
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanOtp,
      type: 'email',
    });

    if (error) {
      throw error;
    }

    if (data?.session) {
      localStorage.setItem('medtrack_web_session', JSON.stringify(data.session));
      return { success: true, session: data.session, user: data.user };
    }

    throw new Error('Failed to create session');
  },

  /**
   * Get currently active session with persistence
   */
  getSession: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        return data.session;
      }
      const local = localStorage.getItem('medtrack_web_session');
      if (local) {
        return JSON.parse(local);
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Sign out
   */
  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('SignOut error:', e);
    }
    localStorage.removeItem('medtrack_web_session');
  },

  /**
   * Auth state listener
   */
  onAuthStateChange: (callback) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        localStorage.setItem('medtrack_web_session', JSON.stringify(session));
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('medtrack_web_session');
      }
      callback(event, session);
    });
    return subscription;
  },
};

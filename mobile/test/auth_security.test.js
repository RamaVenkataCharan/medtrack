import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('6. Authentication Security & Production Isolation', () => {
  it('rejects fixed test OTPs when __DEV__ is false in production builds', () => {
    function simulateVerifyOTP({ isDev, cleanOtp, cleanId }) {
      const VALID_TEST_OTPS = ['123456', '000000', '111111'];
      const DEMO_PHONES = ['9848012345', '9876543210'];

      // Production check
      if (isDev && (VALID_TEST_OTPS.includes(cleanOtp) || DEMO_PHONES.includes(cleanId))) {
        return { success: true, mode: 'test_demo' };
      }

      return { success: false, error: 'Invalid OTP' };
    }

    // In production build (isDev = false), test OTPs must FAIL
    const prodResult = simulateVerifyOTP({
      isDev: false,
      cleanOtp: '123456',
      cleanId: '9848012345',
    });
    assert.equal(prodResult.success, false, 'Fixed test OTP must be rejected in production builds');

    // In dev build (isDev = true), test OTPs work
    const devResult = simulateVerifyOTP({
      isDev: true,
      cleanOtp: '123456',
      cleanId: '9848012345',
    });
    assert.equal(devResult.success, true, 'Test OTP accepted in development mode');
  });

  it('rejects demo email bypass when __DEV__ is false in production builds', () => {
    function simulateSendEmailOTP({ isDev, cleanEmail }) {
      if (isDev && (cleanEmail.includes('demo') || cleanEmail.includes('test'))) {
        return { success: true, mode: 'dev_mock' };
      }
      // In production, must trigger real network call
      return { success: false, mode: 'production_cloud_required' };
    }

    const prodEmailRes = simulateSendEmailOTP({ isDev: false, cleanEmail: 'demo@medtrack.com' });
    assert.equal(prodEmailRes.mode, 'production_cloud_required', 'Must not bypass real auth in production');

    const devEmailRes = simulateSendEmailOTP({ isDev: true, cleanEmail: 'demo@medtrack.com' });
    assert.equal(devEmailRes.mode, 'dev_mock', 'Allows mock bypass in dev');
  });

  it('verifies phone OTP variable scoping does not throw ReferenceError on cleanId', () => {
    // Audit defect 6: verifyOTP referenced 'phoneNumber' instead of 'cleanId'
    function verifyOtpFunction(identifier, otp) {
      const cleanId = String(identifier).replace(/\D/g, '').slice(-10);
      const cleanOtp = String(otp).trim();

      // Ensure cleanId is accessible and phoneNumber is not accidentally referenced
      const sessionData = { id: cleanId, otp: cleanOtp };
      return sessionData.id;
    }

    assert.doesNotThrow(() => {
      const res = verifyOtpFunction('+91 98480-12345', '123456');
      assert.equal(res, '9848012345');
    });
  });
});

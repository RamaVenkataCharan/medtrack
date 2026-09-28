import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('7. Reminders, Expiry Classification & Dynamic Licence Derivation', () => {
  it('correctly classifies expired reminders when due date is in the past', () => {
    const today = new Date('2026-09-28T00:00:00Z');

    function calculateReminderStatus(dueDateStr) {
      const dDate = new Date(dueDateStr);
      if (isNaN(dDate.getTime())) throw new Error('Invalid date');
      const daysLeft = Math.ceil((dDate - today) / (1000 * 60 * 60 * 24));
      const isExpired = daysLeft < 0;
      return {
        days_left: daysLeft,
        is_expired: isExpired,
        status: isExpired ? 'Expired' : 'Active',
      };
    }

    // Past date (expired)
    const expiredRem = calculateReminderStatus('2026-09-20');
    assert.equal(expiredRem.is_expired, true, 'Date in past must be marked expired');
    assert.equal(expiredRem.status, 'Expired');
    assert.ok(expiredRem.days_left < 0);

    // Future date (active)
    const activeRem = calculateReminderStatus('2026-10-15');
    assert.equal(activeRem.is_expired, false, 'Future date must be active');
    assert.equal(activeRem.status, 'Active');
    assert.ok(activeRem.days_left > 0);
  });

  it('rejects invalid reminder dates with clear validation error', () => {
    function validateReminderDate(dueDateStr) {
      if (!dueDateStr || isNaN(new Date(dueDateStr).getTime())) {
        throw new Error('Please enter a valid due date (YYYY-MM-DD).');
      }
      return true;
    }

    assert.throws(() => validateReminderDate('invalid-date'), /valid due date/);
    assert.throws(() => validateReminderDate(''), /valid due date/);
    assert.doesNotThrow(() => validateReminderDate('2027-12-31'));
  });

  it('dynamically derives licence banner message from actual shop profile rather than static text', () => {
    function deriveLicenceNotice(shopProfile) {
      if (!shopProfile?.pharmacist_license_validity) {
        return {
          title: 'No Active Licences Configured',
          description: 'Add your pharmacist or shop licence validity date in Settings to receive automated renewal reminders.',
        };
      }

      const pDate = new Date(shopProfile.pharmacist_license_validity);
      const now = new Date('2026-09-28');
      const days = Math.ceil((pDate - now) / (1000 * 60 * 60 * 24));
      const isExpired = days < 0;

      return {
        title: 'Pharmacist Licence Expiry',
        description: isExpired
          ? `Licence expired on ${shopProfile.pharmacist_license_validity}. Immediate renewal is required.`
          : `Valid till ${shopProfile.pharmacist_license_validity} (${days} days remaining). Advance alert active.`,
      };
    }

    // With real profile
    const notice = deriveLicenceNotice({ pharmacist_license_validity: '2028-12-31' });
    assert.equal(notice.title, 'Pharmacist Licence Expiry');
    assert.ok(notice.description.includes('2028-12-31'));

    // Without profile
    const emptyNotice = deriveLicenceNotice(null);
    assert.equal(emptyNotice.title, 'No Active Licences Configured');
  });
});

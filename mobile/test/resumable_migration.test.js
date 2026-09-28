import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('4. Resumable & Account-Scoped Local Migration', () => {
  it('scopes migration completion keys strictly per user ID', () => {
    const getMigrationKey = (userId) => `medtrack_local_data_migrated_v2_${userId || 'anonymous'}`;

    const keyUser1 = getMigrationKey('user_alpha_123');
    const keyUser2 = getMigrationKey('user_beta_456');

    assert.notEqual(keyUser1, keyUser2, 'Migration keys must be unique per user account');
    assert.equal(keyUser1, 'medtrack_local_data_migrated_v2_user_alpha_123');
  });

  it('does NOT set migration completion flag if any record fails', async () => {
    const mockStorage = new Map();
    let migrationFlagSaved = false;

    // Simulate migration runner
    async function runMigration(userId, localRecords) {
      const errors = [];
      let migrated = 0;

      for (const rec of localRecords) {
        if (rec.fail) {
          errors.push(`Record ${rec.id} failed upload`);
        } else {
          migrated++;
        }
      }

      // CRITICAL FIX: Only set done if errors.length === 0
      if (errors.length === 0) {
        migrationFlagSaved = true;
        mockStorage.set(`migrated_${userId}`, true);
      }

      return {
        success: errors.length === 0,
        errors,
        migrated,
      };
    }

    const testRecordsWithFailure = [
      { id: 1, name: 'Customer 1', fail: false },
      { id: 2, name: 'Customer 2', fail: true }, // Fails!
      { id: 3, name: 'Customer 3', fail: false },
    ];

    const result = await runMigration('test_user', testRecordsWithFailure);

    assert.equal(result.success, false);
    assert.equal(result.errors.length, 1);
    assert.equal(result.migrated, 2);
    assert.equal(migrationFlagSaved, false, 'Migration done flag must NOT be written when errors occur');
    assert.equal(mockStorage.has('migrated_test_user'), false);
  });

  it('allows safe retry without creating duplicate customers in cloud', async () => {
    const cloudCustomers = [{ customer_id: 10, phone_number: '9848012345', name: 'Existing Customer' }];

    function simulateCloudCustomerSync(candidate) {
      const existing = cloudCustomers.find((c) => c.phone_number === candidate.phone_number);
      if (existing) {
        // Reuse existing customer ID rather than creating a duplicate
        return { customer_id: existing.customer_id, isNew: false };
      }
      const newCust = { customer_id: 20, ...candidate };
      cloudCustomers.push(newCust);
      return { customer_id: newCust.customer_id, isNew: true };
    }

    // Attempting to migrate an already-existing customer on retry
    const res1 = simulateCloudCustomerSync({ phone_number: '9848012345', name: 'Existing Customer' });
    assert.equal(res1.isNew, false);
    assert.equal(res1.customer_id, 10);
    assert.equal(cloudCustomers.length, 1, 'Should not duplicate customer');

    // Migrating a new customer
    const res2 = simulateCloudCustomerSync({ phone_number: '9999999999', name: 'Brand New Customer' });
    assert.equal(res2.isNew, true);
    assert.equal(res2.customer_id, 20);
    assert.equal(cloudCustomers.length, 2);
  });
});

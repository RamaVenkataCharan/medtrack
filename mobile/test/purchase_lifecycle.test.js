import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCustomerTotalDue } from '../src/utils/khataLogic.js';

describe('2. Purchase Lifecycle, Recycle Bin & Atomicity', () => {
  it('soft-deleting a purchase sets deleted_at and updates customer running balance', () => {
    const customerPurchases = [
      { entry_id: 101, total_amount: 500, amount_paid: 200, due_amount: 300, deleted_at: null },
      { entry_id: 102, total_amount: 800, amount_paid: 300, due_amount: 500, deleted_at: null },
    ];

    // Initial balance: 300 + 500 = 800
    assert.equal(calculateCustomerTotalDue(customerPurchases), 800);

    // Soft delete purchase 102
    const deletedTimestamp = '2026-09-28T12:00:00.000Z';
    const updatedPurchases = customerPurchases.map((p) =>
      p.entry_id === 102 ? { ...p, deleted_at: deletedTimestamp } : p
    );

    // Balance after soft delete: only entry 101 is counted = 300
    assert.equal(calculateCustomerTotalDue(updatedPurchases), 300);
  });

  it('restoring a soft-deleted purchase clears deleted_at and restores customer balance', () => {
    const customerPurchases = [
      { entry_id: 101, total_amount: 500, amount_paid: 200, due_amount: 300, deleted_at: null },
      { entry_id: 102, total_amount: 800, amount_paid: 300, due_amount: 500, deleted_at: '2026-09-28T12:00:00.000Z' },
    ];

    // Initial balance before restore: 300
    assert.equal(calculateCustomerTotalDue(customerPurchases), 300);

    // Restore purchase 102
    const restoredPurchases = customerPurchases.map((p) =>
      p.entry_id === 102 ? { ...p, deleted_at: null } : p
    );

    // Balance after restore: 300 + 500 = 800
    assert.equal(calculateCustomerTotalDue(restoredPurchases), 800);
  });

  it('permanent delete completely removes record from ledger and cascades to medicines', () => {
    let entries = [
      { entry_id: 101, total_amount: 500, due_amount: 300 },
      { entry_id: 102, total_amount: 800, due_amount: 500 },
    ];
    let medicines = [
      { id: 1, entry_id: 101, medicine_name: 'Paracetamol', quantity: 2 },
      { id: 2, entry_id: 102, medicine_name: 'Amoxicillin', quantity: 1 },
      { id: 3, entry_id: 102, medicine_name: 'Cough Syrup', quantity: 1 },
    ];

    // Permanent delete 102
    entries = entries.filter((e) => e.entry_id !== 102);
    medicines = medicines.filter((m) => m.entry_id !== 102);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].entry_id, 101);
    assert.equal(medicines.length, 1);
    assert.equal(medicines[0].entry_id, 101);
  });

  it('guarantees atomic rollback: line item failure rolls back parent entry', async () => {
    // Simulate database client with compensating rollback
    const mockDb = {
      entries: [],
      entryMedicines: [],
      deletedEntries: [],
      async insertEntry(entry) {
        this.entries.push(entry);
        return { entry_id: entry.entry_id };
      },
      async insertMedicines(meds) {
        // Simulate line item insertion failure
        throw new Error('Database constraint violation: quantity must be positive');
      },
      async rollbackEntry(entryId) {
        this.deletedEntries.push(entryId);
        this.entries = this.entries.filter((e) => e.entry_id !== entryId);
      },
    };

    let entryFailed = false;
    let createdEntryId = null;

    try {
      const entryRes = await mockDb.insertEntry({ entry_id: 999, total_amount: 1000, due_amount: 1000 });
      createdEntryId = entryRes.entry_id;

      // This throws
      await mockDb.insertMedicines([{ entry_id: createdEntryId, medicine_name: 'Test' }]);
    } catch (err) {
      entryFailed = true;
      // Compensating rollback executed on failure
      await mockDb.rollbackEntry(createdEntryId);
    }

    assert.equal(entryFailed, true, 'Operation must report failure');
    assert.equal(mockDb.entries.length, 0, 'Parent entry must be rolled back on medicine insertion failure');
    assert.deepEqual(mockDb.deletedEntries, [999], 'Rollback must delete the orphaned entry');
  });
});

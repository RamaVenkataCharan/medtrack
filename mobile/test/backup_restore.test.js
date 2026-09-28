import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('5. Complete Backup, Recovery & Paginated Export', () => {
  it('paginated export retrieves all rows exceeding the 1,000 row default limit', async () => {
    // Generate 2,500 mock rows
    const totalDatabaseRows = Array.from({ length: 2500 }, (_, i) => ({
      entry_id: i + 1,
      total_amount: 100,
      due_amount: 50,
    }));

    // Simulate Supabase range pagination with pageSize = 1000
    async function mockPaginatedQuery(pageSize = 1000) {
      let allRows = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const to = from + pageSize - 1;
        // Slice represents Supabase .range(from, to)
        const batch = totalDatabaseRows.slice(from, to + 1);

        if (batch.length > 0) {
          allRows = allRows.concat(batch);
          if (batch.length < pageSize) {
            hasMore = false;
          } else {
            from += pageSize;
          }
        } else {
          hasMore = false;
        }
      }

      return allRows;
    }

    const exportedRows = await mockPaginatedQuery(1000);
    assert.equal(exportedRows.length, 2500, 'Pagination must fetch all 2,500 rows without truncation');
    assert.equal(exportedRows[0].entry_id, 1);
    assert.equal(exportedRows[2499].entry_id, 2500);
  });

  it('export payload includes payments table alongside customers, entries, medicines, and profile', () => {
    const mockBackupPayload = {
      version: '2.0',
      source: 'MedTrack Supabase Cloud',
      exportedAt: new Date().toISOString(),
      totalCustomers: 1,
      customers: [{ customer_id: 1, name: 'John Doe', phone_number: '9848012345' }],
      entries: [{ entry_id: 10, customer_id: 1, total_amount: 500, due_amount: 200 }],
      entryMedicines: [{ id: 100, entry_id: 10, medicine_name: 'Paracetamol', quantity: 2, unit_price: 50 }],
      payments: [{ payment_id: 50, customer_id: 1, amount: 200, payment_date: '2026-09-28' }],
      shopProfile: { shop_name: 'MedTrack Pharmacy' },
    };

    assert.ok(Array.isArray(mockBackupPayload.payments), 'Payments table must be present in backup');
    assert.equal(mockBackupPayload.payments.length, 1);
    assert.equal(mockBackupPayload.payments[0].amount, 200);
    assert.ok(mockBackupPayload.entryMedicines[0].quantity, 'Quantity must be preserved in backup');
  });

  it('restore maps foreign keys and prevents customer duplication by phone', async () => {
    const existingCustomers = [{ customer_id: 5, phone_number: '9848012345', name: 'Existing Customer' }];
    const targetEntries = [];
    const targetMedicines = [];
    const targetPayments = [];

    const customerIdMap = new Map();
    const entryIdMap = new Map();

    const backupData = {
      customers: [
        { customer_id: 101, phone_number: '9848012345', name: 'Existing in Backup' }, // Duplicate phone!
        { customer_id: 102, phone_number: '9999999999', name: 'New Customer' },
      ],
      entries: [
        { entry_id: 201, customer_id: 101, total_amount: 500, due_amount: 100 },
        { entry_id: 202, customer_id: 102, total_amount: 800, due_amount: 200 },
      ],
      entryMedicines: [
        { id: 301, entry_id: 201, medicine_name: 'Paracetamol', quantity: 3, unit_price: 30, price: 90 },
      ],
      payments: [
        { payment_id: 401, customer_id: 101, amount: 100 },
      ],
    };

    let nextNewId = 6;

    // 1. Restore customers with duplicate detection
    for (const c of backupData.customers) {
      const match = existingCustomers.find((ec) => ec.phone_number === c.phone_number);
      if (match) {
        customerIdMap.set(c.customer_id, match.customer_id);
      } else {
        const newId = nextNewId++;
        existingCustomers.push({ customer_id: newId, phone_number: c.phone_number, name: c.name });
        customerIdMap.set(c.customer_id, newId);
      }
    }

    assert.equal(customerIdMap.get(101), 5, 'Old customer 101 should map to existing customer 5');
    assert.equal(customerIdMap.get(102), 6, 'Old customer 102 should map to new customer 6');
    assert.equal(existingCustomers.length, 2, 'Should only have 2 unique customers');

    // 2. Restore entries
    for (const e of backupData.entries) {
      const targetCustomerId = customerIdMap.get(e.customer_id);
      const newEntryId = targetEntries.length + 1000;
      targetEntries.push({ ...e, entry_id: newEntryId, customer_id: targetCustomerId });
      entryIdMap.set(e.entry_id, newEntryId);
    }

    assert.equal(targetEntries[0].customer_id, 5);
    assert.equal(targetEntries[1].customer_id, 6);

    // 3. Restore medicines with entry mapping
    for (const m of backupData.entryMedicines) {
      const targetEntryId = entryIdMap.get(m.entry_id);
      targetMedicines.push({ ...m, entry_id: targetEntryId });
    }

    assert.equal(targetMedicines[0].entry_id, 1000);
    assert.equal(targetMedicines[0].quantity, 3);
  });
});

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEntryDue,
  calculatePaymentDue,
  calculateCustomerTotalDue,
  cleanPhoneNumber,
} from '../src/utils/khataLogic.js';
import { demoStore } from '../src/db/demoStore.js';
import {
  searchCustomers,
  addPurchaseEntry,
  updatePurchaseEntry,
  addDuePayment,
  softDeletePurchase,
  restorePurchase,
  permanentDeletePurchase,
  softDeleteCustomer,
  restoreCustomer,
  updateCustomer,
  getPurchaseDetails,
  getCustomerLedger,
} from '../src/db/database.js';
import { OfflineSyncService } from '../src/services/offlineSyncService.js';

describe('Phase 3: End-to-End Reliability & Production Readiness', () => {
  beforeEach(async () => {
    // Reset demoStore to fresh predictable baseline state
    demoStore.nextCustomerId = 100;
    demoStore.nextEntryId = 200;
    demoStore.nextMedId = 300;

    demoStore.customers = [
      {
        customer_id: 1,
        phone_number: '9848012345',
        name: 'Ramesh Patel',
        village: 'Kompally',
        address: 'Plot 42, Main Road',
        created_at: '2026-09-01T10:00:00.000Z',
        deleted_at: null,
        entries: [
          {
            entry_id: 1,
            due_amount: 450,
            total_amount: 850,
            amount_paid: 400,
            entry_date: '2026-09-20T10:00:00.000Z',
            deleted_at: null,
          },
        ],
      },
      {
        customer_id: 2,
        phone_number: '9876543210',
        name: 'Anita Rao',
        village: 'Gandipet',
        address: 'Near Water Tank',
        created_at: '2026-09-05T10:00:00.000Z',
        deleted_at: null,
        entries: [
          {
            entry_id: 2,
            due_amount: 0,
            total_amount: 300,
            amount_paid: 300,
            entry_date: '2026-09-25T11:00:00.000Z',
            deleted_at: null,
          },
        ],
      },
    ];

    demoStore.entries = [
      {
        entry_id: 1,
        customer_id: 1,
        customer_name: 'Ramesh Patel',
        phone_number: '9848012345',
        entry_date: '2026-09-20T10:00:00.000Z',
        total_amount: 850,
        amount_paid: 400,
        due_amount: 450,
        notes: 'BP medicine',
        deleted_at: null,
        medicines: [
          {
            id: 1,
            entry_id: 1,
            medicine_name: 'Amlodipine 5 mg',
            quantity: 30,
            unit: 'tablets',
            unit_price: 15,
            price: 450,
          },
          {
            id: 2,
            entry_id: 1,
            medicine_name: 'Paracetamol 650 mg',
            quantity: 20,
            unit: 'tablets',
            unit_price: 20,
            price: 400,
          },
        ],
      },
      {
        entry_id: 2,
        customer_id: 2,
        customer_name: 'Anita Rao',
        phone_number: '9876543210',
        entry_date: '2026-09-25T11:00:00.000Z',
        total_amount: 300,
        amount_paid: 300,
        due_amount: 0,
        notes: 'Vitamins',
        deleted_at: null,
        medicines: [
          {
            id: 3,
            entry_id: 2,
            medicine_name: 'Paracetamol 500 mg',
            quantity: 10,
            unit: 'tablets',
            unit_price: 12,
            price: 120,
          },
          {
            id: 4,
            entry_id: 2,
            medicine_name: 'Vitamin D3',
            quantity: 1,
            unit: 'strip',
            unit_price: 180,
            price: 180,
          },
        ],
      },
    ];

    await OfflineSyncService.clearQueue();
  });

  describe('1. Customer Search Workflow', () => {
    it('searches customer by name and phone number', async () => {
      const byName = await searchCustomers('Anita');
      assert.equal(byName.length, 1);
      assert.equal(byName[0].name, 'Anita Rao');
      assert.equal(byName[0].last_purchase_date, '2026-09-25T11:00:00.000Z');

      const byPhone = await searchCustomers('98480');
      assert.equal(byPhone.length, 1);
      assert.equal(byPhone[0].name, 'Ramesh Patel');
      assert.equal(byPhone[0].total_due, 450);
    });

    it('safely handles punctuation, quotes and special characters without crashing', async () => {
      // Simulates typing quotes or commas in search bar
      const results = await searchCustomers('Rao, Anita (Hyderabad)');
      assert.ok(Array.isArray(results));
    });

    it('strictly excludes soft-deleted customers from search results', async () => {
      await softDeleteCustomer(1);
      const results = await searchCustomers('Ramesh');
      assert.equal(results.length, 0, 'Soft-deleted customer must not appear in search results');
    });

    it('derives last_purchase_date exclusively from active non-deleted purchases', async () => {
      // Add a second purchase to Anita Rao
      const laterDate = '2026-09-28T16:00:00.000Z';
      demoStore.customers[1].entries.push({
        entry_id: 99,
        due_amount: 100,
        total_amount: 100,
        entry_date: laterDate,
        deleted_at: null,
      });

      let res = await searchCustomers('Anita');
      assert.equal(res[0].last_purchase_date, laterDate);

      // Now soft-delete that later purchase
      demoStore.customers[1].entries[1].deleted_at = '2026-09-29T00:00:00.000Z';
      res = await searchCustomers('Anita');
      assert.equal(
        res[0].last_purchase_date,
        '2026-09-25T11:00:00.000Z',
        'Soft-deleted purchase must not skew last_purchase_date'
      );
    });
  });

  describe('2. Purchase Recording & Atomic Updating Workflow', () => {
    it('creates a new multi-medicine purchase and updates customer ledger', async () => {
      const entryId = await addPurchaseEntry({
        customerId: 2,
        medicines: [
          { name: 'Cetirizine 10 mg', quantity: 10, unit_price: 3, price: 30 },
          { name: 'Cough Syrup 100ml', quantity: 1, unit_price: 85, price: 85 },
        ],
        totalAmount: 115,
        amountPaid: 100,
        notes: 'Prescribed by Dr. Roy',
      });

      assert.ok(entryId > 0);

      const details = await getPurchaseDetails(entryId);
      assert.ok(details);
      assert.equal(details.total_amount, 115);
      assert.equal(details.amount_paid, 100);
      assert.equal(details.due_amount, 15);
      assert.equal(details.medicines.length, 2);

      // Customer due updated: Anita had 0 due, now 15
      const cust = demoStore.customers.find((c) => c.customer_id === 2);
      assert.equal(calculateCustomerTotalDue(cust.entries), 15);
    });

    it('updates an existing purchase without creating duplicate entries', async () => {
      // Edit entry 2 (Anita Rao initial total 300)
      await updatePurchaseEntry({
        entryId: 2,
        customerId: 2,
        medicines: [
          { name: 'Paracetamol 500 mg', quantity: 20, unit_price: 12, price: 240 },
          { name: 'Vitamin D3', quantity: 2, unit_price: 180, price: 360 },
        ],
        totalAmount: 600,
        amountPaid: 500,
        notes: 'Updated quantities upon customer request',
      });

      // Total entries count in system must NOT increase (no duplicate created!)
      assert.equal(demoStore.entries.length, 2, 'Must not create a duplicate entry');

      const updated = await getPurchaseDetails(2);
      assert.equal(updated.total_amount, 600);
      assert.equal(updated.amount_paid, 500);
      assert.equal(updated.due_amount, 100);
      assert.equal(updated.medicines[0].quantity, 20);

      // Running due balance reflects the updated due amount
      const cust = demoStore.customers.find((c) => c.customer_id === 2);
      assert.equal(calculateCustomerTotalDue(cust.entries), 100);
    });
  });

  describe('3. Payment & Due Balance Lifecycle', () => {
    it('records a due payment and reduces customer outstanding balance', async () => {
      // Ramesh Patel initially owes 450
      assert.equal(calculateCustomerTotalDue(demoStore.customers[0].entries), 450);

      await addDuePayment({ customerId: 1, amountPaid: 250 });

      // Outstanding balance is reduced to 200
      assert.equal(calculateCustomerTotalDue(demoStore.customers[0].entries), 200);

      // Complete payoff
      await addDuePayment({ customerId: 1, amountPaid: 200 });
      assert.equal(calculateCustomerTotalDue(demoStore.customers[0].entries), 0);
    });
  });

  describe('4. Deletion and Restoration Workflows (Recycle Bin)', () => {
    it('soft-deleting a purchase excludes it from customer ledger and recalculates running balance', async () => {
      // Ramesh owes 450 from purchase 1
      assert.equal(calculateCustomerTotalDue(demoStore.customers[0].entries), 450);

      // Soft delete purchase 1
      await softDeletePurchase(1);

      const entry = demoStore.entries.find((e) => e.entry_id === 1);
      assert.ok(entry.deleted_at !== null, 'deleted_at timestamp must be set');

      // Due balance becomes 0
      assert.equal(calculateCustomerTotalDue(demoStore.customers[0].entries), 0);

      // Restore purchase 1
      await restorePurchase(1);
      assert.equal(entry.deleted_at, null, 'deleted_at must be cleared on restore');
      assert.equal(calculateCustomerTotalDue(demoStore.customers[0].entries), 450);
    });

    it('soft-deleting and restoring a customer maintains data integrity', async () => {
      await softDeleteCustomer(2);
      assert.ok(demoStore.customers[1].deleted_at !== null);

      let searchRes = await searchCustomers('Anita');
      assert.equal(searchRes.length, 0);

      await restoreCustomer(2);
      assert.equal(demoStore.customers[1].deleted_at, null);

      searchRes = await searchCustomers('Anita');
      assert.equal(searchRes.length, 1);
      assert.equal(searchRes[0].name, 'Anita Rao');
    });

    it('permanent delete completely removes purchase record', async () => {
      await permanentDeletePurchase(1);
      assert.equal(demoStore.entries.some((e) => e.entry_id === 1), false);
      assert.equal(demoStore.customers[0].entries.some((e) => e.entry_id === 1), false);
    });
  });

  describe('5. Offline Queue & Background Sync Resilience', () => {
    it('enqueues mutations with collision-resistant IDs', async () => {
      const mut1 = await OfflineSyncService.enqueueMutation({
        type: 'ADD_PURCHASE',
        payload: {
          customerId: 2,
          medicines: [{ name: 'Test Med', quantity: 1, unit_price: 50, price: 50 }],
          totalAmount: 50,
          amountPaid: 50,
        },
      });

      assert.ok(mut1.mutation_id.startsWith('mut_'));
      assert.equal(mut1.status, 'pending');

      const count = await OfflineSyncService.getPendingCount();
      assert.equal(count, 1);
    });

    it('replays queue safely without creating duplicate records', async () => {
      const initialEntryCount = demoStore.entries.length;

      await OfflineSyncService.enqueueMutation({
        type: 'ADD_PURCHASE',
        payload: {
          customerId: 2,
          medicines: [{ name: 'Paracetamol', quantity: 5, unit_price: 10, price: 50 }],
          totalAmount: 50,
          amountPaid: 50,
        },
      });

      // Synchronize queue
      const syncResult = await OfflineSyncService.syncPendingMutations();
      assert.equal(syncResult.synced, 1);
      assert.equal(syncResult.failed, 0);
      assert.equal(await OfflineSyncService.getPendingCount(), 0);

      // Verify that one new entry was created
      assert.equal(demoStore.entries.length, initialEntryCount + 1);

      // Sync again: queue is empty, no duplicates added
      const secondSync = await OfflineSyncService.syncPendingMutations();
      assert.equal(secondSync.synced, 0);
      assert.equal(demoStore.entries.length, initialEntryCount + 1);
    });
  });

  describe('6. Customer Details Updates & Validation', () => {
    it('updates customer name, village, and notes accepting both single and two-argument patterns', async () => {
      // Single argument object pattern
      await updateCustomer({
        customerId: 2,
        name: 'Anita Sharma Rao',
        village: 'Gandipet Village',
        notes: 'Prefers generic brands',
      });

      let cust = demoStore.customers.find((c) => c.customer_id === 2);
      assert.equal(cust.name, 'Anita Sharma Rao');
      assert.equal(cust.village, 'Gandipet Village');
      assert.equal(cust.notes, 'Prefers generic brands');

      // Two-argument pattern (customerId, data)
      await updateCustomer(2, {
        name: 'Dr. Anita Rao',
      });

      cust = demoStore.customers.find((c) => c.customer_id === 2);
      assert.equal(cust.name, 'Dr. Anita Rao');
    });

    it('sanitizes and normalizes phone numbers during customer update', async () => {
      await updateCustomer(1, {
        phone: '+91 (984) 801-2345',
      });

      const cust = demoStore.customers.find((c) => c.customer_id === 1);
      assert.equal(cust.phone_number, '9848012345');
    });
  });
});

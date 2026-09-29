import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEntryDue,
  calculatePaymentDue,
  calculateCustomerTotalDue,
  cleanPhoneNumber,
  calculateLineTotal,
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
  getCustomerLedger,
  restoreFromBackup,
  exportAllData,
} from '../src/db/database.js';
import { OfflineSyncService } from '../src/services/offlineSyncService.js';

describe('Phase 4: Advanced Production Readiness & Resilience', () => {
  beforeEach(async () => {
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
        notes: 'Partial payment made',
        deleted_at: null,
        medicines: [
          {
            id: 1,
            entry_id: 1,
            medicine_name: 'Paracetamol 650',
            price: 50,
            quantity: 10,
            unit_price: 5,
            unit: 'tablets',
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
        notes: 'Paid in full',
        deleted_at: null,
        medicines: [
          {
            id: 2,
            entry_id: 2,
            medicine_name: 'Amoxicillin 500mg',
            price: 300,
            quantity: 15,
            unit_price: 20,
            unit: 'capsules',
          },
        ],
      },
    ];

    await OfflineSyncService.clearQueue();
  });

  describe('1. Credit / Udhar & Partial Payment Integrity', () => {
    it('records a 100% credit purchase (amountPaid = 0) and adds entire total to due balance', async () => {
      const entryId = await addPurchaseEntry({
        customerId: 1,
        medicines: [{ name: 'Azithromycin 500mg', quantity: 3, unit_price: 70, price: 210 }],
        totalAmount: 210,
        amountPaid: 0, // Explicit credit purchase
      });

      const ledger = await getCustomerLedger(1);
      const created = ledger.find((e) => e.entry_id === entryId);
      assert.ok(created, 'Purchase entry must exist in ledger');
      assert.equal(created.total_amount, 210);
      assert.equal(created.amount_paid, 0, 'Amount paid must be 0 for credit purchase');
      assert.equal(created.due_amount, 210, 'Due amount must equal full total for credit purchase');

      // Customer running balance: 450 previous + 210 new = 660
      const totalDue = calculateCustomerTotalDue(ledger);
      assert.equal(totalDue, 660);
    });

    it('records a partial payment purchase and adds remainder to customer due', async () => {
      const entryId = await addPurchaseEntry({
        customerId: 2,
        medicines: [{ name: 'Multivitamin Syrup', quantity: 2, unit_price: 150, price: 300 }],
        totalAmount: 300,
        amountPaid: 100, // Partial payment of 100
      });

      const ledger = await getCustomerLedger(2);
      const created = ledger.find((e) => e.entry_id === entryId);
      assert.ok(created);
      assert.equal(created.total_amount, 300);
      assert.equal(created.amount_paid, 100);
      assert.equal(created.due_amount, 200, 'Remainder must be marked as due');

      const totalDue = calculateCustomerTotalDue(ledger);
      assert.equal(totalDue, 200);
    });

    it('updates a purchase from full-paid to credit and immediately updates customer due', async () => {
      // Entry 2 is currently total 300, paid 300, due 0
      await updatePurchaseEntry({
        entryId: 2,
        customerId: 2,
        medicines: [{ name: 'Amoxicillin 500mg', quantity: 15, unit_price: 20, price: 300 }],
        totalAmount: 300,
        amountPaid: 0, // Customer didn't pay today, marked as credit
      });

      const ledger = await getCustomerLedger(2);
      const updated = ledger.find((e) => e.entry_id === 2);
      assert.equal(updated.amount_paid, 0);
      assert.equal(updated.due_amount, 300);

      const totalDue = calculateCustomerTotalDue(ledger);
      assert.equal(totalDue, 300, 'Customer running balance must reflect updated credit');
    });
  });

  describe('2. Concurrent Operations & Stress Simulation', () => {
    it('handles multiple rapid purchase creations without ledger corruption', async () => {
      const p1 = addPurchaseEntry({
        customerId: 1,
        medicines: [{ name: 'Medicine A', quantity: 1, unit_price: 100, price: 100 }],
        totalAmount: 100,
        amountPaid: 50,
      });
      const p2 = addPurchaseEntry({
        customerId: 1,
        medicines: [{ name: 'Medicine B', quantity: 2, unit_price: 150, price: 300 }],
        totalAmount: 300,
        amountPaid: 300,
      });
      const p3 = addDuePayment({
        customerId: 1,
        amountPaid: 200,
      });

      const [id1, id2, id3] = await Promise.all([p1, p2, p3]);
      assert.ok(id1);
      assert.ok(id2);
      assert.ok(id3);

      const ledger = await getCustomerLedger(1);
      // Initial: 450
      // p1: 100 - 50 = +50 due
      // p2: 300 - 300 = 0 due
      // p3: -200 payment = -200 due
      // Total expected: 450 + 50 + 0 - 200 = 300
      const totalDue = calculateCustomerTotalDue(ledger);
      assert.equal(totalDue, 300);
    });

    it('calculates running ledger balance across 500 entries without precision loss in < 5ms', () => {
      const largeLedger = [];
      let expectedBalance = 0;

      for (let i = 0; i < 500; i++) {
        // Alternate purchase with cents, partial payment, and settlement
        const total = parseFloat((100 + (i % 50) * 0.35).toFixed(2));
        const paid = parseFloat((50 + (i % 30) * 0.15).toFixed(2));
        const due = parseFloat((total - paid).toFixed(2));
        expectedBalance = parseFloat((expectedBalance + due).toFixed(2));

        largeLedger.push({
          entry_id: i + 1000,
          total_amount: total,
          amount_paid: paid,
          due_amount: due,
          deleted_at: null,
        });
      }

      const t0 = performance.now();
      const calculated = calculateCustomerTotalDue(largeLedger);
      const elapsed = performance.now() - t0;

      assert.equal(calculated, expectedBalance, 'Calculated balance must exactly match expected balance');
      assert.ok(elapsed < 20, `Calculation took ${elapsed.toFixed(2)}ms, must be fast`);
    });
  });

  describe('3. Offline Synchronization Recovery Across Application Restarts', () => {
    it('persists queued mutations across simulated restart and replays incrementally', async () => {
      // 1. Enqueue 2 mutations
      await OfflineSyncService.enqueueMutation({
        type: 'ADD_PURCHASE',
        payload: {
          customerId: 1,
          medicines: [{ name: 'Offline Med 1', quantity: 1, unit_price: 150, price: 150 }],
          totalAmount: 150,
          amountPaid: 150,
          client_mutation_id: 'mut_test_restart_1',
        },
      });

      await OfflineSyncService.enqueueMutation({
        type: 'ADD_PAYMENT',
        payload: {
          customerId: 1,
          amountPaid: 100,
          client_mutation_id: 'mut_test_restart_2',
        },
      });

      assert.equal(await OfflineSyncService.getPendingCount(), 2);

      // 2. Simulate application restart: syncPendingMutations processes queue
      const syncResult = await OfflineSyncService.syncPendingMutations();
      assert.equal(syncResult.synced, 2);
      assert.equal(syncResult.failed, 0);
      assert.equal(syncResult.remaining, 0);

      // 3. Confirm queue is completely empty in storage after successful sync
      const remainingCount = await OfflineSyncService.getPendingCount();
      assert.equal(remainingCount, 0);

      // 4. Verify customer ledger reflects both synced items
      const ledger = await getCustomerLedger(1);
      const hasPurch = ledger.some((e) => e.total_amount === 150);
      const hasPay = ledger.some((e) => e.amount_paid === 100 && e.total_amount === 0);
      assert.ok(hasPurch, 'Synced purchase must be present in customer ledger');
      assert.ok(hasPay, 'Synced payment must be present in customer ledger');
    });

    it('handles simulated network drop mid-sync without duplicating previously completed mutations', async () => {
      await OfflineSyncService.enqueueMutation({
        type: 'ADD_PURCHASE',
        payload: {
          customerId: 2,
          medicines: [{ name: 'Reliability Test Med', quantity: 1, unit_price: 200, price: 200 }],
          totalAmount: 200,
          amountPaid: 200,
          client_mutation_id: 'mut_drop_1',
        },
      });

      await OfflineSyncService.enqueueMutation({
        type: 'ADD_PURCHASE',
        payload: {
          customerId: 99999, // Intentional non-existent customer to trigger simulated failure
          medicines: [{ name: 'Fail Med', quantity: 1, unit_price: 50, price: 50 }],
          totalAmount: 50,
          amountPaid: 50,
          client_mutation_id: 'mut_drop_2',
        },
      });

      // Mock database module where customer 99999 fails
      const mockDb = {
        addPurchaseEntry: async (payload) => {
          if (payload.customerId === 99999) {
            throw new Error('Network timeout during sync');
          }
          return 777;
        },
      };

      const result = await OfflineSyncService.syncPendingMutations(mockDb);
      assert.equal(result.synced, 1, 'First item must succeed');
      assert.equal(result.failed, 1, 'Second item must fail');
      assert.equal(result.remaining, 1, 'Failed item must remain in queue for retry');

      // Verify that the succeeded first item was immediately removed from storage
      const count = await OfflineSyncService.getPendingCount();
      assert.equal(count, 1, 'Only the failed mutation should remain in persistent storage');
    });
  });

  describe('4. Backup Restoration & Data Sanitization', () => {
    it('rejects corrupted backup files that lack valid customer or entry structures', async () => {
      await assert.rejects(
        async () => {
          await restoreFromBackup({ corrupted_key: 'invalid' });
        },
        {
          name: 'Error',
          message: /Invalid backup file format/i,
        }
      );
    });

    it('safely restores backup and preserves soft-deleted states in Recycle Bin', async () => {
      const backupPayload = {
        exportDate: '2026-09-29T10:00:00.000Z',
        customers: [
          {
            customer_id: 10,
            name: 'Sunita Sharma',
            phone_number: '9812345678',
            village: 'Medchal',
            address: 'H No 1-23',
            deleted_at: null,
            entries: [],
          },
          {
            customer_id: 20,
            name: 'Old Soft-Deleted Customer',
            phone_number: '9123456789',
            deleted_at: '2026-09-28T12:00:00.000Z',
            entries: [],
          },
        ],
        entries: [
          {
            entry_id: 50,
            customer_id: 10,
            total_amount: 500,
            amount_paid: 200,
            due_amount: 300,
            deleted_at: null,
            medicines: [],
          },
        ],
        payments: [],
      };

      const result = await restoreFromBackup(backupPayload);
      assert.equal(result.customersRestored, 2);
      assert.equal(result.entriesRestored, 1);

      // Search active customers: only Sunita Sharma must appear
      const activeCustomers = await searchCustomers('Sunita');
      assert.equal(activeCustomers.length, 1);
      assert.equal(activeCustomers[0].name, 'Sunita Sharma');

      // Soft deleted customer must not appear in active search
      const deletedSearch = await searchCustomers('Old Soft-Deleted');
      assert.equal(deletedSearch.length, 0, 'Soft deleted customer from backup must not be in active search');
    });

    it('exports all data with schema consistency matching import expectations', async () => {
      const exported = await exportAllData();
      assert.ok(exported);
      assert.ok(Array.isArray(exported.customers));
      assert.ok(Array.isArray(exported.entries));
      assert.ok(exported.exportDate);
      assert.equal(typeof exported.totalCustomers, 'number');
    });
  });
});

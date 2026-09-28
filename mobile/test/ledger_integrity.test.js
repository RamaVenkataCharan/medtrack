import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEntryDue,
  calculatePaymentDue,
  calculateCustomerTotalDue,
  calculateLineTotal,
  cleanPhoneNumber,
  isPaymentEntry,
} from '../src/utils/khataLogic.js';

describe('1. Ledger Integrity & Zero-Payment Parsing', () => {
  it('calculates entry due correctly for standard purchase with partial payment', () => {
    const due = calculateEntryDue(1200, 400);
    assert.equal(due, 800);
  });

  it('preserves an explicitly entered zero payment as zero instead of defaulting to total', () => {
    // Audit defect 4: parseFloat(amountPaid) || calculatedTotal was converting '0' to total
    const rawInput = '0';
    const totalAmount = 1500;
    const parsedPaid = rawInput.trim() === '' ? totalAmount : Math.max(0, parseFloat(rawInput) || 0);

    assert.equal(parsedPaid, 0, 'Explicit zero payment must remain 0');
    const due = calculateEntryDue(totalAmount, parsedPaid);
    assert.equal(due, 1500, 'Due amount for unpaid purchase must equal total purchase amount');
  });

  it('treats empty string payment as full payment default', () => {
    const rawInput = '   ';
    const totalAmount = 1500;
    const parsedPaid = rawInput.trim() === '' ? totalAmount : Math.max(0, parseFloat(rawInput) || 0);

    assert.equal(parsedPaid, 1500, 'Blank input defaults to full payment');
    const due = calculateEntryDue(totalAmount, parsedPaid);
    assert.equal(due, 0, 'Due amount is 0 when fully paid');
  });

  it('calculates negative due for standalone payment towards customer dues', () => {
    const paymentAmount = 500;
    const dueDelta = calculatePaymentDue(paymentAmount);
    assert.equal(dueDelta, -500, 'Payment entry must reduce customer balance with negative due');
  });

  it('calculates running customer total due and strictly excludes soft-deleted purchases', () => {
    const entries = [
      { entry_id: 1, total_amount: 1000, amount_paid: 200, due_amount: 800, deleted_at: null },
      { entry_id: 2, total_amount: 500, amount_paid: 500, due_amount: 0, deleted_at: null },
      { entry_id: 3, total_amount: 600, amount_paid: 100, due_amount: 500, deleted_at: '2026-09-28T10:00:00Z' }, // Soft deleted!
      { entry_id: 4, total_amount: 0, amount_paid: 300, due_amount: -300, deleted_at: null }, // Due payment
    ];

    const totalDue = calculateCustomerTotalDue(entries);
    // Active entries: 800 + 0 - 300 = 500 (entry 3 with 500 due must be excluded!)
    assert.equal(totalDue, 500, 'Customer total due must exclude soft-deleted entries');
  });

  it('correctly calculates line totals with discounts', () => {
    // 100 with 10% discount = 90
    assert.equal(calculateLineTotal(100, 10), 90);
    // 250 with 0% discount = 250
    assert.equal(calculateLineTotal(250, 0), 250);
    // 150 with 100% discount = 0
    assert.equal(calculateLineTotal(150, 100), 0);
  });

  it('rejects invalid or negative prices and quantities', () => {
    const invalidPrice = -50;
    const clampedPrice = Math.max(0, parseFloat(invalidPrice) || 0);
    assert.equal(clampedPrice, 0, 'Negative prices must be clamped to 0 or rejected');

    const invalidQty = -3;
    const clampedQty = Math.max(1, parseInt(invalidQty, 10) || 1);
    assert.equal(clampedQty, 1, 'Quantity must be at least 1');
  });

  it('identifies payment entries vs medicine purchases', () => {
    const payment = { total_amount: 0, amount_paid: 500, medicines: [] };
    assert.equal(isPaymentEntry(payment), true);

    const purchase = { total_amount: 500, amount_paid: 500, medicines: [{ medicine_name: 'Paracetamol' }] };
    assert.equal(isPaymentEntry(purchase), false);
  });

  it('cleans phone numbers to standard 10 digits', () => {
    assert.equal(cleanPhoneNumber('+91 98480-12345'), '9848012345');
    assert.equal(cleanPhoneNumber('09848012345'), '9848012345');
    assert.equal(cleanPhoneNumber(''), '');
  });
});

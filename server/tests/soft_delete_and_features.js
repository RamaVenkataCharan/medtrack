const assert = require('assert');
const {
  getDb,
  addEntry,
  getCustomerDue,
  softDeleteCustomer,
  restoreCustomer,
  permanentDeleteCustomer,
  getDeletedCustomers,
  getShopProfile,
  updateShopProfile,
} = require('../db/database');

console.log('🧪 Running Server Soft-Delete, Shop Profile & Discount Tests...');
const db = getDb();

// 1. Create a test customer
const insertResult = db.prepare(`
  INSERT INTO customers (name, phone_number, village, address)
  VALUES ('Test Customer Soft', '9123456789', 'Hyd', 'Road 1')
`).run();
const customerId = insertResult.lastInsertRowid;

// 2. Add an entry with discount
// Item 1: price 100 with 5% discount -> net 95
// Item 2: price 200 with 10% discount -> net 180
// Total: 275. Paid: 100. Due: 175
const entry = addEntry({
  customerId,
  totalAmount: 275,
  amountPaid: 100,
  medicines: [
    { name: 'Med 1', price: 100, discount_percent: 5 },
    { name: 'Med 2', price: 200, discount_percent: 10 },
  ],
});

assert.strictEqual(entry.totalAmount, 275);
assert.strictEqual(entry.dueAmount, 175);
assert.strictEqual(entry.medicines[0].price, 95);
assert.strictEqual(entry.medicines[0].discount_percent, 5);
assert.strictEqual(entry.medicines[0].original_price, 100);
console.log('✅ Discount percentage calculated correctly on entry');

// 3. Verify customer due
const due = getCustomerDue(customerId);
assert.strictEqual(due, 175);
console.log('✅ Customer due computed as ₹175');

// 4. Test soft-delete
softDeleteCustomer(customerId);
const afterSoftDelete = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
assert.ok(afterSoftDelete.deleted_at !== null, 'deleted_at should be non-null');

// Search query must exclude soft-deleted
const searchActive = db.prepare('SELECT * FROM customers WHERE (deleted_at IS NULL) AND phone_number = ?').all('9123456789');
assert.strictEqual(searchActive.length, 0, 'Soft deleted customer must not appear in active search');

// Recycle bin must include them
const deletedList = getDeletedCustomers();
const foundInBin = deletedList.find((c) => c.customer_id === customerId);
assert.ok(foundInBin, 'Customer must appear in recycle bin');
assert.strictEqual(foundInBin.total_due, 175, 'Recycle bin retains due amount');
console.log('✅ Soft delete successfully hid customer from search and moved to Recycle Bin');

// 5. Test restore
restoreCustomer(customerId);
const restored = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
assert.strictEqual(restored.deleted_at, null, 'deleted_at must be null after restore');
const searchRestored = db.prepare('SELECT * FROM customers WHERE (deleted_at IS NULL) AND phone_number = ?').all('9123456789');
assert.strictEqual(searchRestored.length, 1, 'Restored customer reappears in search');
console.log('✅ Restore successfully brought customer back to active search');

// 6. Test permanent delete (cascade)
permanentDeleteCustomer(customerId);
const afterHardDelete = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
assert.strictEqual(afterHardDelete, undefined, 'Customer must be completely removed');

const remainingEntries = db.prepare('SELECT * FROM entries WHERE customer_id = ?').all(customerId);
assert.strictEqual(remainingEntries.length, 0, 'Cascaded entries must be deleted');
console.log('✅ Permanent delete successfully cascaded all related entries and customer record');

// 7. Test shop profile
const profile = getShopProfile();
assert.ok(profile.shop_name, 'Shop profile must have shop_name');

const updatedProfile = updateShopProfile({
  shop_name: 'Super Medico',
  license_20b: '20B-1234',
  license_21b: '21B-5678',
  shop_license_validity: '2027-12-31',
  shop_phone: '9848011111',
  pharmacist_name: 'Charan Pharmacist',
  pharmacist_phone: '9493972442',
  pharmacist_license_validity: '2028-06-30',
});
assert.strictEqual(updatedProfile.shop_name, 'Super Medico');
assert.strictEqual(updatedProfile.license_20b, '20B-1234');
console.log('✅ Shop & Pharmacist profile GET and UPDATE verified');

console.log('\n🎉 ALL SOFT-DELETE, DISCOUNT, AND SHOP PROFILE SERVER TESTS PASSED!');

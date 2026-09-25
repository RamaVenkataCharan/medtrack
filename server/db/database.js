const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

let dbInstance = null;

function getDb() {
  if (dbInstance) return dbInstance;

  const dbDir = path.dirname(config.DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(config.DB_PATH);

  // Performance and integrity pragma settings
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('synchronous = NORMAL');

  // Non-destructive column migrations (runs before schema indexes)
  try {
    const tableNames = dbInstance.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);
    if (tableNames.includes('customers')) {
      const customerCols = dbInstance.pragma('table_info(customers)').map((c) => c.name);
      if (!customerCols.includes('deleted_at')) {
        dbInstance.exec('ALTER TABLE customers ADD COLUMN deleted_at TEXT DEFAULT NULL;');
      }
    }

    if (tableNames.includes('entry_medicine')) {
      const medCols = dbInstance.pragma('table_info(entry_medicine)').map((c) => c.name);
      if (!medCols.includes('discount_percent')) {
        dbInstance.exec('ALTER TABLE entry_medicine ADD COLUMN discount_percent REAL NOT NULL DEFAULT 0;');
      }
      if (!medCols.includes('original_price')) {
        dbInstance.exec('ALTER TABLE entry_medicine ADD COLUMN original_price REAL DEFAULT NULL;');
      }
    }
  } catch (migErr) {
    console.warn('[Pre-migration notice]:', migErr.message);
  }

  // Initialize schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    dbInstance.exec(schemaSql);
  }

  // Ensure shop_profile exists and has row 1
  try {
    dbInstance.exec(`
      INSERT OR IGNORE INTO shop_profile (id, shop_name, license_20b, license_21b, shop_license_validity, shop_phone, pharmacist_name, pharmacist_phone, pharmacist_license_validity)
      VALUES (1, 'MedTrack Pharmacy', 'AP/NZB/20B/2024-9871', 'AP/NZB/21B/2024-9872', '2028-12-31', '9848012345', 'R. Venkata Charan', '9493972442', '2029-06-30');
    `);
  } catch (profErr) {
    console.warn('[Shop profile seed notice]:', profErr.message);
  }

  return dbInstance;
}

function closeDb() {
  if (dbInstance) {
    try {
      dbInstance.pragma('wal_checkpoint(TRUNCATE)');
      dbInstance.close();
    } catch (e) {
      console.warn('DB close notice:', e.message);
    }
    dbInstance = null;
  }
}

/**
 * Calculates customer's exact total due from ledger data:
 * total_due = SUM(entries.due_amount) - SUM(payments.amount)
 */
function getCustomerDue(customerId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      ROUND(COALESCE(SUM(e.due_amount), 0) - (
        SELECT COALESCE(SUM(p.amount), 0)
        FROM payments p
        WHERE p.customer_id = ?
      ), 2) AS total_due
    FROM entries e
    WHERE e.customer_id = ?
  `).get(customerId, customerId);

  return row ? Math.max(0, row.total_due || 0) : 0;
}

/**
 * Records a purchase entry atomically in a SQLite transaction
 * Inserts into `entries` and `entry_medicine`
 */
function addEntry({ customerId, totalAmount, amountPaid, medicines, entryDate }) {
  const db = getDb();

  if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
    throw new Error('Entry requires at least one medicine item');
  }

  const cleanTotal = Math.round(parseFloat(totalAmount) * 100) / 100;
  if (isNaN(cleanTotal) || cleanTotal <= 0) {
    throw new Error('Total amount must be greater than 0');
  }

  const cleanPaid = Math.round(parseFloat(amountPaid || 0) * 100) / 100;
  if (isNaN(cleanPaid) || cleanPaid < 0) {
    throw new Error('Amount paid cannot be negative');
  }

  if (cleanPaid > cleanTotal) {
    throw new Error(`Amount paid (₹${cleanPaid}) cannot exceed total amount (₹${cleanTotal})`);
  }

  const dueCreated = Math.round((cleanTotal - cleanPaid) * 100) / 100;

  const tx = db.transaction(() => {
    // 1. Verify customer
    const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // 2. Insert entry
    const insertEntryStmt = db.prepare(`
      INSERT INTO entries (customer_id, entry_date, total_amount, amount_paid, due_amount)
      VALUES (?, COALESCE(?, datetime('now')), ?, ?, ?)
    `);

    const entryResult = insertEntryStmt.run(
      customerId,
      entryDate || null,
      cleanTotal,
      cleanPaid,
      dueCreated
    );
    const entryId = entryResult.lastInsertRowid;

    // 3. Insert line items into entry_medicine
    const insertMedStmt = db.prepare(`
      INSERT INTO entry_medicine (entry_id, medicine_name, price, discount_percent, original_price)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertedMeds = [];
    for (const med of medicines) {
      const name = (med.name || med.medicine_name || '').trim();
      if (!name) continue;
      const rawPrice = Math.round(parseFloat(med.original_price ?? med.price ?? 0) * 100) / 100;
      const discount = Math.min(100, Math.max(0, parseFloat(med.discount_percent || 0) || 0));
      // Net price = price - (price * discount / 100), clamped between 0 and rawPrice
      const netPrice = Math.max(0, Math.min(rawPrice, Math.round((rawPrice - (rawPrice * discount / 100)) * 100) / 100));

      insertMedStmt.run(entryId, name, netPrice, discount, rawPrice);
      insertedMeds.push({ medicine_name: name, price: netPrice, discount_percent: discount, original_price: rawPrice });
    }

    if (insertedMeds.length === 0) {
      throw new Error('At least one medicine name must be specified');
    }

    // 4. Update customer updated_at
    db.prepare(`UPDATE customers SET updated_at = datetime('now') WHERE customer_id = ?`).run(customerId);

    // 5. Get refreshed total due
    const newTotalDue = getCustomerDue(customerId);

    return {
      entryId,
      customerId,
      customerName: customer.name,
      phone: customer.phone_number,
      village: customer.village,
      totalAmount: cleanTotal,
      amountPaid: cleanPaid,
      dueAmount: dueCreated,
      totalDue: newTotalDue,
      medicines: insertedMeds,
      entryDate: entryDate || new Date().toISOString(),
    };
  });

  return tx();
}

/**
 * Record a payment towards customer dues
 */
function recordPayment({ customerId, amount, note }) {
  const db = getDb();
  const cleanAmount = Math.round(parseFloat(amount) * 100) / 100;

  if (isNaN(cleanAmount) || cleanAmount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }

  const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const previousDue = getCustomerDue(customerId);

  const insertStmt = db.prepare(`
    INSERT INTO payments (customer_id, amount, note)
    VALUES (?, ?, ?)
  `);

  const result = insertStmt.run(customerId, cleanAmount, note || 'Cash counter settlement');
  const remainingDue = getCustomerDue(customerId);

  // Update customer updated_at
  db.prepare(`UPDATE customers SET updated_at = datetime('now') WHERE customer_id = ?`).run(customerId);

  return {
    paymentId: result.lastInsertRowid,
    customerId,
    customerName: customer.name,
    amount: cleanAmount,
    note: note || 'Cash counter settlement',
    previousDue,
    remainingDue,
    payDate: new Date().toISOString(),
  };
}

/**
 * Get customer stats: computed due, last visit, and recently bought distinct medicines
 */
function getCustomerStats(customerId) {
  const db = getDb();

  const totalDue = getCustomerDue(customerId);

  const lastEntry = db.prepare(`
    SELECT entry_date
    FROM entries
    WHERE customer_id = ?
    ORDER BY entry_date DESC, entry_id DESC
    LIMIT 1
  `).get(customerId);

  const aggregates = db.prepare(`
    SELECT
      COUNT(*) AS total_visits,
      COALESCE(SUM(total_amount), 0) AS total_spent
    FROM entries
    WHERE customer_id = ?
  `).get(customerId);

  // Last 5 distinct medicines with frequency
  const recentMeds = db.prepare(`
    SELECT
      em.medicine_name,
      COUNT(*) AS frequency,
      MAX(e.entry_date) AS last_date,
      ROUND(julianday('now') - julianday(MAX(e.entry_date))) AS days_ago
    FROM entries e
    JOIN entry_medicine em ON e.entry_id = em.entry_id
    WHERE e.customer_id = ?
    GROUP BY LOWER(em.medicine_name)
    ORDER BY last_date DESC
    LIMIT 5
  `).all(customerId);

  return {
    total_due: totalDue,
    last_visit: lastEntry ? lastEntry.entry_date : null,
    total_visits: aggregates ? aggregates.total_visits : 0,
    total_spent: aggregates ? Math.round(aggregates.total_spent * 100) / 100 : 0,
    recently_bought: recentMeds.map((m) => ({
      name: m.medicine_name,
      frequency: m.frequency,
      lastDate: m.last_date,
      daysAgo: Math.max(0, parseInt(m.days_ago, 10) || 0),
    })),
  };
}

/**
 * Autocomplete medicine names based on past purchases
 */
function autocompleteMedicines(query) {
  const db = getDb();
  const q = (query || '').trim();
  if (!q) {
    return db.prepare(`
      SELECT DISTINCT medicine_name
      FROM entry_medicine
      ORDER BY id DESC
      LIMIT 10
    `).all().map((r) => r.medicine_name);
  }

  return db.prepare(`
    SELECT DISTINCT medicine_name
    FROM entry_medicine
    WHERE medicine_name LIKE ?
    ORDER BY medicine_name ASC
    LIMIT 10
  `).all(`%${q}%`).map((r) => r.medicine_name);
}

/**
 * Soft delete a customer: marks deleted_at timestamp
 */
function softDeleteCustomer(customerId) {
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const result = db.prepare(`
    UPDATE customers
    SET deleted_at = datetime('now'), updated_at = datetime('now')
    WHERE customer_id = ?
  `).run(customerId);

  return { success: result.changes > 0, customerId };
}

/**
 * Restore a soft-deleted customer
 */
function restoreCustomer(customerId) {
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const result = db.prepare(`
    UPDATE customers
    SET deleted_at = NULL, updated_at = datetime('now')
    WHERE customer_id = ?
  `).run(customerId);

  return { success: result.changes > 0, customerId };
}

/**
 * Permanent hard delete a customer and cascades all ledger data
 */
function permanentDeleteCustomer(customerId) {
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const tx = db.transaction(() => {
    // 1. Delete all entry_medicines
    const entries = db.prepare('SELECT entry_id FROM entries WHERE customer_id = ?').all(customerId);
    const entryIds = entries.map((e) => e.entry_id);

    if (entryIds.length > 0) {
      const placeholders = entryIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM entry_medicine WHERE entry_id IN (${placeholders})`).run(...entryIds);
    }

    // 2. Delete entries
    db.prepare('DELETE FROM entries WHERE customer_id = ?').run(customerId);

    // 3. Delete payments
    db.prepare('DELETE FROM payments WHERE customer_id = ?').run(customerId);

    // 4. Delete customer
    db.prepare('DELETE FROM customers WHERE customer_id = ?').run(customerId);

    return { success: true, customerId };
  });

  return tx();
}

/**
 * Retrieve all soft-deleted customers for Recycle Bin
 */
function getDeletedCustomers() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT customer_id, phone_number, name, village, address, deleted_at, created_at, updated_at
    FROM customers
    WHERE deleted_at IS NOT NULL
    ORDER BY deleted_at DESC
  `).all();

  return rows.map((c) => ({
    ...c,
    total_due: getCustomerDue(c.customer_id),
  }));
}

/**
 * Get shop profile
 */
function getShopProfile() {
  const db = getDb();
  const profile = db.prepare('SELECT * FROM shop_profile WHERE id = 1').get();
  return (
    profile || {
      id: 1,
      shop_name: 'MedTrack Pharmacy',
      license_20b: '',
      license_21b: '',
      shop_license_validity: '',
      shop_phone: '',
      pharmacist_name: '',
      pharmacist_phone: '',
      pharmacist_license_validity: '',
    }
  );
}

/**
 * Update shop profile
 */
function updateShopProfile(data) {
  const db = getDb();
  const updateStmt = db.prepare(`
    UPDATE shop_profile
    SET
      shop_name = COALESCE(?, shop_name),
      license_20b = ?,
      license_21b = ?,
      shop_license_validity = ?,
      shop_phone = ?,
      pharmacist_name = ?,
      pharmacist_phone = ?,
      pharmacist_license_validity = ?,
      updated_at = datetime('now')
    WHERE id = 1
  `);

  updateStmt.run(
    data.shop_name ? data.shop_name.trim() : 'MedTrack Pharmacy',
    data.license_20b ? data.license_20b.trim() : null,
    data.license_21b ? data.license_21b.trim() : null,
    data.shop_license_validity ? data.shop_license_validity.trim() : null,
    data.shop_phone ? data.shop_phone.trim() : null,
    data.pharmacist_name ? data.pharmacist_name.trim() : null,
    data.pharmacist_phone ? data.pharmacist_phone.trim() : null,
    data.pharmacist_license_validity ? data.pharmacist_license_validity.trim() : null
  );

  return getShopProfile();
}

module.exports = {
  getDb,
  closeDb,
  getCustomerDue,
  addEntry,
  recordPayment,
  softDeleteCustomer,
  restoreCustomer,
  permanentDeleteCustomer,
  getDeletedCustomers,
  getShopProfile,
  updateShopProfile,
  getCustomerStats,
  autocompleteMedicines,
};

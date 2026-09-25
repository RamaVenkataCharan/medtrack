import { Platform } from 'react-native';
import { getCurrentLocalIso } from '../utils/dateUtils';
import {
  cleanPhoneNumber,
  calculateEntryDue,
  calculatePaymentDue,
  calculateCustomerTotalDue,
} from '../utils/khataLogic';

// ─────────────────────────────────────────────────────────────
// 1. NATIVE SQLITE DRIVER (Android / iOS)
// ─────────────────────────────────────────────────────────────
let nativeDb = null;

function getNativeDb() {
  if (!nativeDb) {
    const SQLite = require('expo-sqlite');
    nativeDb = SQLite.openDatabaseSync('medtrack_mobile.db');
  }
  return nativeDb;
}

function initNativeDatabase() {
  const db = getNativeDb();
  db.execSync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS customers (
      customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      village TEXT,
      address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
      entry_date TEXT DEFAULT CURRENT_TIMESTAMP,
      total_amount REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      due_amount REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS entry_medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES entries(entry_id),
      medicine_name TEXT NOT NULL,
      price REAL DEFAULT 0,
      original_price REAL DEFAULT NULL,
      discount_percent REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS shop_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      shop_name TEXT DEFAULT '',
      shop_license_no TEXT DEFAULT '',
      license_20b TEXT DEFAULT '',
      license_21b TEXT DEFAULT '',
      shop_license_validity TEXT DEFAULT '',
      shop_phone TEXT DEFAULT '',
      pharmacist_name TEXT DEFAULT '',
      pharmacist_phone TEXT DEFAULT '',
      pharmacist_license_validity TEXT DEFAULT '',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO shop_profile (id) VALUES (1);

    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);
    CREATE INDEX IF NOT EXISTS idx_entries_customer ON entries(customer_id);
    CREATE INDEX IF NOT EXISTS idx_entry_meds_entry ON entry_medicines(entry_id);
  `);

  // Non-destructive migration: guarantee deleted_at column exists for pre-existing databases
  try {
    const tableInfo = db.getAllSync(`PRAGMA table_info(customers);`);
    const hasDeletedAt = tableInfo.some((col) => col.name === 'deleted_at');
    if (!hasDeletedAt) {
      db.execSync(`ALTER TABLE customers ADD COLUMN deleted_at TEXT DEFAULT NULL;`);
      console.log('[MedTrack] Migration: added deleted_at column to customers');
    }
    db.execSync(`CREATE INDEX IF NOT EXISTS idx_customers_deleted ON customers(deleted_at);`);
  } catch (err) {
    console.warn('[MedTrack] Migration notice for deleted_at:', err.message);
  }

  // Non-destructive migration: guarantee license_20b and license_21b exist on shop_profile
  try {
    const shopInfo = db.getAllSync(`PRAGMA table_info(shop_profile);`);
    const has20b = shopInfo.some((col) => col.name === 'license_20b');
    if (!has20b) {
      db.execSync(`ALTER TABLE shop_profile ADD COLUMN license_20b TEXT DEFAULT '';`);
      db.execSync(`ALTER TABLE shop_profile ADD COLUMN license_21b TEXT DEFAULT '';`);
      console.log('[MedTrack] Migration: added license_20b and license_21b columns to shop_profile');
    }
  } catch (err) {
    console.warn('[MedTrack] Migration notice for shop_profile columns:', err.message);
  }

  // Non-destructive migration: guarantee original_price & discount_percent exist on entry_medicines
  try {
    const medInfo = db.getAllSync(`PRAGMA table_info(entry_medicines);`);
    const hasDiscount = medInfo.some((col) => col.name === 'discount_percent');
    if (!hasDiscount) {
      db.execSync(`ALTER TABLE entry_medicines ADD COLUMN original_price REAL DEFAULT NULL;`);
      db.execSync(`ALTER TABLE entry_medicines ADD COLUMN discount_percent REAL DEFAULT 0;`);
      console.log('[MedTrack] Migration: added original_price and discount_percent to entry_medicines');
    }
  } catch (err) {
    console.warn('[MedTrack] Migration notice for entry_medicines discount columns:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// 2. WEB PERSISTENT DRIVER (Localhost browser fallback only)
// ─────────────────────────────────────────────────────────────
const WEB_STORAGE_KEY = 'medtrack_web_db_v1';

function getWebState() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(WEB_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.shop_profile) {
        parsed.shop_profile = {
          id: 1,
          shop_name: '',
          shop_license_no: '',
          shop_license_validity: '',
          shop_phone: '',
          pharmacist_name: '',
          pharmacist_phone: '',
          pharmacist_license_validity: '',
        };
      }
      if (Array.isArray(parsed.customers)) {
        parsed.customers.forEach((c) => {
          if (c.deleted_at === undefined) c.deleted_at = null;
        });
      }
      return parsed;
    }
  } catch (e) {
    console.warn('Could not read web localStorage:', e);
  }
  const initialDemoCustomers = [
    {
      customer_id: 1,
      name: 'giri',
      phone_number: '7894561230',
      village: '',
      address: '',
      created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
      deleted_at: null,
    },
    {
      customer_id: 2,
      name: 'charan',
      phone_number: '9493972442',
      village: 'nuzvid',
      address: '',
      created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
      deleted_at: null,
    },
    {
      customer_id: 3,
      name: 'Ramesh Kumar',
      phone_number: '9876543210',
      village: 'Nizampet',
      address: 'Near Ramalayam Temple',
      created_at: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
      deleted_at: null,
    },
  ];

  const initialDemoEntries = [
    {
      entry_id: 1,
      customer_id: 1,
      entry_date: new Date(Date.now() - 3600000 * 5).toISOString(),
      total_amount: 50,
      amount_paid: 35,
      due_amount: 15,
    },
    {
      entry_id: 2,
      customer_id: 2,
      entry_date: new Date(Date.now() - 3600000 * 12).toISOString(),
      total_amount: 120,
      amount_paid: 120,
      due_amount: 0,
    },
    {
      entry_id: 3,
      customer_id: 3,
      entry_date: new Date(Date.now() - 3600000 * 24).toISOString(),
      total_amount: 80,
      amount_paid: 80,
      due_amount: 0,
    },
  ];

  return {
    customers: initialDemoCustomers,
    entries: initialDemoEntries,
    entry_medicines: [],
    shop_profile: {
      id: 1,
      shop_name: 'MedTrack Pharmacy',
      shop_license_no: 'DL-20B-123456',
      license_20b: 'DL-20B-123456',
      license_21b: 'DL-21B-789012',
      shop_license_validity: '2027-12-31',
      shop_phone: '+919876543210',
      pharmacist_name: 'Dr. Ramesh Kumar, B.Pharm',
      pharmacist_phone: '+919848012345',
      pharmacist_license_validity: '2027-10-15',
    },
    nextCustomerId: 4,
    nextEntryId: 4,
    nextMedicineId: 1,
  };
}

function saveWebState(state) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(state));
    }
  } catch (e) {
    console.warn('Could not save web localStorage:', e);
  }
}

// ─────────────────────────────────────────────────────────────
// 3. UNIFIED OPERATIONS LAYER
// ─────────────────────────────────────────────────────────────

export function getActiveDriverName() {
  return Platform.OS === 'web' ? 'WEB_FALLBACK (localStorage)' : 'NATIVE_EXPO_SQLITE (SQLite file)';
}

export function initDatabase() {
  const driver = getActiveDriverName();
  console.log(`[MedTrack] Initializing database layer using driver: ${driver}`);

  if (Platform.OS === 'web') {
    const state = getWebState();
    saveWebState(state);
    return;
  }

  initNativeDatabase();
}

/**
 * Searches and lists active customers (excludes soft-deleted customers)
 */
export function searchCustomers(query = '') {
  if (Platform.OS === 'web') {
    const state = getWebState();
    const trimmed = query.trim().toLowerCase();

    // EXCLUDE soft-deleted customers
    const activeCustomers = state.customers.filter((c) => !c.deleted_at);

    const results = activeCustomers.map((c) => {
      const customerEntries = state.entries.filter((e) => e.customer_id === c.customer_id);
      const totalDue = calculateCustomerTotalDue(customerEntries);
      const lastEntry = customerEntries[customerEntries.length - 1];
      return {
        ...c,
        total_due: totalDue,
        last_activity: lastEntry ? lastEntry.entry_date : c.created_at,
      };
    });

    const filtered = trimmed
      ? results.filter(
          (c) =>
            c.name.toLowerCase().includes(trimmed) ||
            c.phone_number.includes(trimmed)
        )
      : results;

    return filtered.sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const trimmed = query.trim();

  if (!trimmed) {
    return db.getAllSync(`
      SELECT 
        c.customer_id, 
        c.phone_number, 
        c.name, 
        c.village, 
        c.address, 
        c.created_at,
        c.deleted_at,
        ROUND(COALESCE(SUM(e.due_amount), 0), 2) AS total_due,
        MAX(e.entry_date) AS last_activity
      FROM customers c
      LEFT JOIN entries e ON c.customer_id = e.customer_id
      WHERE c.deleted_at IS NULL
      GROUP BY c.customer_id
      ORDER BY COALESCE(MAX(e.entry_date), c.created_at) DESC
      LIMIT 100;
    `);
  }

  const pattern = `%${trimmed}%`;
  return db.getAllSync(`
    SELECT 
      c.customer_id, 
      c.phone_number, 
      c.name, 
      c.village, 
      c.address, 
      c.created_at,
      c.deleted_at,
      ROUND(COALESCE(SUM(e.due_amount), 0), 2) AS total_due,
      MAX(e.entry_date) AS last_activity
    FROM customers c
    LEFT JOIN entries e ON c.customer_id = e.customer_id
    WHERE c.deleted_at IS NULL AND (c.phone_number LIKE ? OR c.name LIKE ?)
    GROUP BY c.customer_id
    ORDER BY c.name ASC
    LIMIT 50;
  `, [pattern, pattern]);
}

export function getCustomerById(customerId) {
  const numericId = parseInt(customerId, 10);

  if (Platform.OS === 'web') {
    const state = getWebState();
    const cust = state.customers.find((c) => c.customer_id === numericId);
    if (!cust) return null;

    const custEntries = state.entries.filter((e) => e.customer_id === numericId);
    const totalDue = calculateCustomerTotalDue(custEntries);

    return {
      ...cust,
      total_due: totalDue,
      total_entries: custEntries.length,
    };
  }

  // Native expo-sqlite
  const db = getNativeDb();
  return db.getFirstSync(`
    SELECT 
      c.customer_id, 
      c.phone_number, 
      c.name, 
      c.village, 
      c.address, 
      c.created_at,
      c.deleted_at,
      ROUND(COALESCE(SUM(e.due_amount), 0), 2) AS total_due,
      COUNT(e.entry_id) AS total_entries
    FROM customers c
    LEFT JOIN entries e ON c.customer_id = e.customer_id
    WHERE c.customer_id = ?
    GROUP BY c.customer_id;
  `, [numericId]);
}

export function getCustomerByPhone(phoneNumber) {
  const cleaned = cleanPhoneNumber(phoneNumber);

  if (Platform.OS === 'web') {
    const state = getWebState();
    return state.customers.find((c) => c.phone_number === cleaned && !c.deleted_at) || null;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  return db.getFirstSync(`
    SELECT * FROM customers 
    WHERE (phone_number = ? OR phone_number LIKE ?) AND deleted_at IS NULL
    LIMIT 1;
  `, [cleaned, `%${cleaned}`]);
}

export function addCustomer({ name, phone_number, village, address }) {
  const cleanedPhone = cleanPhoneNumber(phone_number);
  const now = getCurrentLocalIso();

  if (Platform.OS === 'web') {
    const state = getWebState();
    const newCustomer = {
      customer_id: state.nextCustomerId++,
      phone_number: cleanedPhone,
      name: name.trim(),
      village: village ? village.trim() : null,
      address: address ? address.trim() : null,
      created_at: now,
      deleted_at: null,
    };
    state.customers.push(newCustomer);
    saveWebState(state);
    return newCustomer.customer_id;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const result = db.runSync(`
    INSERT INTO customers (phone_number, name, village, address, created_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, NULL);
  `, [cleanedPhone, name.trim(), village ? village.trim() : null, address ? address.trim() : null, now]);

  return result.lastInsertRowId;
}

/**
 * ♻️ Soft-deletes a customer by setting deleted_at timestamp
 */
export function softDeleteCustomer(customerId) {
  const numericId = parseInt(customerId, 10);
  if (!numericId) return false;
  const now = getCurrentLocalIso();

  if (Platform.OS === 'web') {
    const state = getWebState();
    const cust = state.customers.find((c) => c.customer_id === numericId);
    if (cust) {
      cust.deleted_at = now;
      saveWebState(state);
      return true;
    }
    return false;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  db.runSync(`UPDATE customers SET deleted_at = ? WHERE customer_id = ?;`, [now, numericId]);
  return true;
}

/**
 * ♻️ Restores a soft-deleted customer back to active state
 */
export function restoreCustomer(customerId) {
  const numericId = parseInt(customerId, 10);
  if (!numericId) return false;

  if (Platform.OS === 'web') {
    const state = getWebState();
    const cust = state.customers.find((c) => c.customer_id === numericId);
    if (cust) {
      cust.deleted_at = null;
      saveWebState(state);
      return true;
    }
    return false;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  db.runSync(`UPDATE customers SET deleted_at = NULL WHERE customer_id = ?;`, [numericId]);
  return true;
}

/**
 * 💥 Permanently hard-deletes a customer and cascades all entries & medicines
 */
export function permanentDeleteCustomer(customerId) {
  const numericId = parseInt(customerId, 10);
  if (!numericId) return false;

  if (Platform.OS === 'web') {
    const state = getWebState();
    const customerEntries = state.entries.filter((e) => e.customer_id === numericId);
    const entryIds = new Set(customerEntries.map((e) => e.entry_id));

    state.entry_medicines = state.entry_medicines.filter((m) => !entryIds.has(m.entry_id));
    state.entries = state.entries.filter((e) => e.customer_id !== numericId);
    state.customers = state.customers.filter((c) => c.customer_id !== numericId);

    saveWebState(state);
    return true;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  db.withTransactionSync(() => {
    const entries = db.getAllSync(`SELECT entry_id FROM entries WHERE customer_id = ?;`, [numericId]);
    const entryIds = entries.map((e) => e.entry_id);

    if (entryIds.length > 0) {
      const placeholders = entryIds.map(() => '?').join(',');
      db.runSync(`DELETE FROM entry_medicines WHERE entry_id IN (${placeholders});`, entryIds);
    }

    db.runSync(`DELETE FROM entries WHERE customer_id = ?;`, [numericId]);
    db.runSync(`DELETE FROM customers WHERE customer_id = ?;`, [numericId]);
  });

  return true;
}

/**
 * Retrieves all soft-deleted customers for the Recycle Bin screen
 */
export function getDeletedCustomers() {
  if (Platform.OS === 'web') {
    const state = getWebState();
    const deleted = state.customers.filter((c) => Boolean(c.deleted_at));

    return deleted
      .map((c) => {
        const custEntries = state.entries.filter((e) => e.customer_id === c.customer_id);
        const totalDue = calculateCustomerTotalDue(custEntries);
        return {
          ...c,
          total_due: totalDue,
          total_entries: custEntries.length,
        };
      })
      .sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
  }

  // Native expo-sqlite
  const db = getNativeDb();
  return db.getAllSync(`
    SELECT 
      c.customer_id, 
      c.phone_number, 
      c.name, 
      c.village, 
      c.address, 
      c.created_at,
      c.deleted_at,
      ROUND(COALESCE(SUM(e.due_amount), 0), 2) AS total_due,
      COUNT(e.entry_id) AS total_entries
    FROM customers c
    LEFT JOIN entries e ON c.customer_id = e.customer_id
    WHERE c.deleted_at IS NOT NULL
    GROUP BY c.customer_id
    ORDER BY c.deleted_at DESC;
  `);
}

/**
 * Returns count of soft-deleted customers
 */
export function getDeletedCustomerCount() {
  if (Platform.OS === 'web') {
    const state = getWebState();
    return state.customers.filter((c) => Boolean(c.deleted_at)).length;
  }

  const db = getNativeDb();
  try {
    const row = db.getFirstSync(`SELECT COUNT(*) AS cnt FROM customers WHERE deleted_at IS NOT NULL;`);
    return row ? row.cnt : 0;
  } catch {
    return 0;
  }
}

export function getCustomerLedger(customerId) {
  const numericId = parseInt(customerId, 10);

  if (Platform.OS === 'web') {
    const state = getWebState();
    const custEntries = state.entries
      .filter((e) => e.customer_id === numericId)
      .sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date));

    return custEntries.map((entry) => {
      const meds = state.entry_medicines.filter((m) => m.entry_id === entry.entry_id);
      return {
        ...entry,
        medicines: meds,
      };
    });
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const entries = db.getAllSync(`
    SELECT 
      entry_id, 
      customer_id, 
      entry_date, 
      total_amount, 
      amount_paid, 
      due_amount
    FROM entries
    WHERE customer_id = ?
    ORDER BY entry_date DESC, entry_id DESC;
  `, [numericId]);

  const entryIds = entries.map((e) => e.entry_id);
  if (entryIds.length === 0) return [];

  const placeholders = entryIds.map(() => '?').join(',');
  const allMeds = db.getAllSync(`
    SELECT id, entry_id, medicine_name, price 
    FROM entry_medicines 
    WHERE entry_id IN (${placeholders})
    ORDER BY id ASC;
  `, entryIds);

  const medsByEntry = {};
  allMeds.forEach((m) => {
    if (!medsByEntry[m.entry_id]) medsByEntry[m.entry_id] = [];
    medsByEntry[m.entry_id].push(m);
  });

  return entries.map((entry) => ({
    ...entry,
    medicines: medsByEntry[entry.entry_id] || [],
  }));
}

export function addPurchaseEntry({ customerId, medicines = [], totalAmount = 0, amountPaid = 0 }) {
  const numericId = parseInt(customerId, 10);
  const now = getCurrentLocalIso();
  const parsedTotal = parseFloat(totalAmount) || 0;
  const parsedPaid = parseFloat(amountPaid) || 0;
  const dueAmount = calculateEntryDue(parsedTotal, parsedPaid);

  if (Platform.OS === 'web') {
    const state = getWebState();
    const entryId = state.nextEntryId++;
    const newEntry = {
      entry_id: entryId,
      customer_id: numericId,
      entry_date: now,
      total_amount: parsedTotal,
      amount_paid: parsedPaid,
      due_amount: dueAmount,
    };
    state.entries.push(newEntry);

    for (const med of medicines) {
      if (med.name && med.name.trim()) {
        const medPrice = parseFloat(med.price) || 0;
        const origPrice = med.original_price != null ? parseFloat(med.original_price) : medPrice;
        const discPct = med.discount_percent != null ? parseFloat(med.discount_percent) : 0;
        state.entry_medicines.push({
          id: state.nextMedicineId++,
          entry_id: entryId,
          medicine_name: med.name.trim(),
          price: medPrice,
          original_price: origPrice,
          discount_percent: discPct,
        });
      }
    }

    saveWebState(state);
    return entryId;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  let insertedEntryId = null;

  db.withTransactionSync(() => {
    const res = db.runSync(`
      INSERT INTO entries (customer_id, entry_date, total_amount, amount_paid, due_amount)
      VALUES (?, ?, ?, ?, ?);
    `, [numericId, now, parsedTotal, parsedPaid, dueAmount]);

    insertedEntryId = res.lastInsertRowId;

    for (const med of medicines) {
      if (med.name && med.name.trim()) {
        const medPrice = parseFloat(med.price) || 0;
        const origPrice = med.original_price != null ? parseFloat(med.original_price) : medPrice;
        const discPct = med.discount_percent != null ? parseFloat(med.discount_percent) : 0;
        db.runSync(`
          INSERT INTO entry_medicines (entry_id, medicine_name, price, original_price, discount_percent)
          VALUES (?, ?, ?, ?, ?);
        `, [insertedEntryId, med.name.trim(), medPrice, origPrice, discPct]);
      }
    }
  });

  return insertedEntryId;
}

export function addDuePayment({ customerId, amountPaid }) {
  const numericId = parseInt(customerId, 10);
  const now = getCurrentLocalIso();
  const parsedPaid = parseFloat(amountPaid) || 0;
  const dueAmount = calculatePaymentDue(parsedPaid);

  if (Platform.OS === 'web') {
    const state = getWebState();
    const entryId = state.nextEntryId++;
    state.entries.push({
      entry_id: entryId,
      customer_id: numericId,
      entry_date: now,
      total_amount: 0,
      amount_paid: parsedPaid,
      due_amount: dueAmount,
    });
    saveWebState(state);
    return entryId;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const res = db.runSync(`
    INSERT INTO entries (customer_id, entry_date, total_amount, amount_paid, due_amount)
    VALUES (?, ?, 0, ?, ?);
  `, [numericId, now, parsedPaid, dueAmount]);

  return res.lastInsertRowId;
}

export function getPastMedicineNames() {
  if (Platform.OS === 'web') {
    const state = getWebState();
    const names = Array.from(new Set(state.entry_medicines.map((m) => m.medicine_name)));
    return names.sort().slice(0, 100);
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const rows = db.getAllSync(`
    SELECT DISTINCT medicine_name 
    FROM entry_medicines 
    ORDER BY medicine_name ASC 
    LIMIT 100;
  `);
  return rows.map((r) => r.medicine_name);
}

export function getShopProfile() {
  const defaultProfile = {
    id: 1,
    shop_name: '',
    shop_license_no: '',
    license_20b: '',
    license_21b: '',
    shop_license_validity: '',
    shop_phone: '',
    pharmacist_name: '',
    pharmacist_phone: '',
    pharmacist_license_validity: '',
  };

  if (Platform.OS === 'web') {
    const state = getWebState();
    return { ...defaultProfile, ...(state.shop_profile || {}) };
  }

  // Native expo-sqlite
  const db = getNativeDb();
  try {
    const row = db.getFirstSync(`SELECT * FROM shop_profile WHERE id = 1;`);
    return row ? { ...defaultProfile, ...row } : defaultProfile;
  } catch (e) {
    console.warn('Could not read shop_profile from SQLite:', e);
    return defaultProfile;
  }
}

export function saveShopProfile(profile = {}) {
  const sanitized = {
    shop_name: (profile.shop_name || '').trim(),
    shop_license_no: (profile.shop_license_no || '').trim(),
    license_20b: (profile.license_20b || profile.shop_license_no || '').trim(),
    license_21b: (profile.license_21b || '').trim(),
    shop_license_validity: (profile.shop_license_validity || '').trim(),
    shop_phone: (profile.shop_phone || '').trim(),
    pharmacist_name: (profile.pharmacist_name || '').trim(),
    pharmacist_phone: (profile.pharmacist_phone || '').trim(),
    pharmacist_license_validity: (profile.pharmacist_license_validity || '').trim(),
  };

  if (Platform.OS === 'web') {
    const state = getWebState();
    state.shop_profile = {
      id: 1,
      ...sanitized,
    };
    saveWebState(state);
    return state.shop_profile;
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const now = getCurrentLocalIso();
  db.runSync(`
    INSERT INTO shop_profile (
      id,
      shop_name,
      shop_license_no,
      license_20b,
      license_21b,
      shop_license_validity,
      shop_phone,
      pharmacist_name,
      pharmacist_phone,
      pharmacist_license_validity,
      updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      shop_name = excluded.shop_name,
      shop_license_no = excluded.shop_license_no,
      license_20b = excluded.license_20b,
      license_21b = excluded.license_21b,
      shop_license_validity = excluded.shop_license_validity,
      shop_phone = excluded.shop_phone,
      pharmacist_name = excluded.pharmacist_name,
      pharmacist_phone = excluded.pharmacist_phone,
      pharmacist_license_validity = excluded.pharmacist_license_validity,
      updated_at = excluded.updated_at;
  `, [
    sanitized.shop_name,
    sanitized.shop_license_no,
    sanitized.license_20b,
    sanitized.license_21b,
    sanitized.shop_license_validity,
    sanitized.shop_phone,
    sanitized.pharmacist_name,
    sanitized.pharmacist_phone,
    sanitized.pharmacist_license_validity,
    now,
  ]);

  return getShopProfile();
}

/**
 * Exports all data, including soft-deleted customers clearly flagged with is_deleted and deleted_at
 */
export function exportAllData() {
  const shopProfile = getShopProfile();

  if (Platform.OS === 'web') {
    const state = getWebState();
    const formattedCustomers = state.customers.map((c) => ({
      ...c,
      is_deleted: Boolean(c.deleted_at),
      deleted_at: c.deleted_at || null,
    }));

    return {
      version: '1.0',
      exportedAt: getCurrentLocalIso(),
      totalCustomers: formattedCustomers.length,
      activeCustomers: formattedCustomers.filter((c) => !c.is_deleted).length,
      deletedCustomers: formattedCustomers.filter((c) => c.is_deleted).length,
      customers: formattedCustomers,
      entries: state.entries,
      entryMedicines: state.entry_medicines,
      shopProfile,
    };
  }

  // Native expo-sqlite
  const db = getNativeDb();
  const rawCustomers = db.getAllSync(`SELECT * FROM customers ORDER BY customer_id ASC;`);
  const formattedCustomers = rawCustomers.map((c) => ({
    ...c,
    is_deleted: Boolean(c.deleted_at),
    deleted_at: c.deleted_at || null,
  }));
  const entries = db.getAllSync(`SELECT * FROM entries ORDER BY entry_id ASC;`);
  const entryMedicines = db.getAllSync(`SELECT * FROM entry_medicines ORDER BY id ASC;`);

  return {
    version: '1.0',
    exportedAt: getCurrentLocalIso(),
    totalCustomers: formattedCustomers.length,
    activeCustomers: formattedCustomers.filter((c) => !c.is_deleted).length,
    deletedCustomers: formattedCustomers.filter((c) => c.is_deleted).length,
    customers: formattedCustomers,
    entries,
    entryMedicines,
    shopProfile,
  };
}

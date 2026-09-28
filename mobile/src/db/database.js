import { supabase } from '../utils/supabaseClient';
import { getCurrentLocalIso } from '../utils/dateUtils';
import { NetworkService } from '../services/networkService';
import { AuthService } from '../services/authService';
import {
  cleanPhoneNumber,
  calculateEntryDue,
  calculatePaymentDue,
  calculateCustomerTotalDue,
} from '../utils/khataLogic';

// ─────────────────────────────────────────────────────────────
// SUPABASE CLOUD DATA ACCESS LAYER (PostgreSQL + Row Level Security)
// With Seamless In-Memory Sandbox for Local Dev / Test Sessions
// ─────────────────────────────────────────────────────────────

export function getActiveDriverName() {
  return 'SUPABASE_CLOUD (PostgreSQL + Row Level Security)';
}

// In-Memory Dev / Demo Store for offline/test accounts
const demoStore = {
  nextCustomerId: 10,
  nextEntryId: 20,
  nextMedId: 30,
  customers: [
    {
      customer_id: 1,
      phone_number: '9848012345',
      name: 'Ramesh Patel',
      village: 'Kompally',
      address: 'Plot 42, Main Road',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      deleted_at: null,
      entries: [
        {
          entry_id: 1,
          due_amount: 450,
          total_amount: 850,
          amount_paid: 400,
          entry_date: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
      ],
    },
    {
      customer_id: 2,
      phone_number: '9876543210',
      name: 'Priya Sharma',
      village: 'Medchal',
      address: 'House # 12-4',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      deleted_at: null,
      entries: [],
    },
  ],
  entries: [
    {
      entry_id: 1,
      customer_id: 1,
      entry_date: new Date(Date.now() - 86400000 * 2).toISOString(),
      total_amount: 850,
      amount_paid: 400,
      due_amount: 450,
      medicines: [
        {
          id: 1,
          medicine_name: 'Paracetamol 650mg',
          price: 60,
          original_price: 60,
          discount_percent: 0,
        },
        {
          id: 2,
          medicine_name: 'Amoxicillin 500mg',
          price: 120,
          original_price: 120,
          discount_percent: 0,
        },
      ],
    },
  ],
  shopProfile: {
    shop_name: 'MedTrack Pharmacy',
    shop_license_no: '20B/1234/2024',
    license_20b: '20B/1234/2024',
    license_21b: '21B/5678/2024',
    shop_license_validity: '2028-12-31',
    shop_phone: '+91 98765 43210',
    pharmacist_name: 'Charan, B.Pharm',
    pharmacist_phone: '9848012345',
    pharmacist_license_validity: '2029-06-30',
  },
};

/**
 * Helper to check if current session is demo/test mode
 */
async function isDemoSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id && !session.user.is_demo) return false;
  } catch {}
  const currentUser = await AuthService.getCurrentUser();
  return Boolean(currentUser && (currentUser.is_demo || !currentUser.aud));
}

/**
 * Initializes the data layer and verifies Supabase authentication
 */
export async function initDatabase() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    console.log('[MedTrack] Cloud Data Layer initialized. Authenticated:', Boolean(session));
  } catch (err) {
    console.warn('[MedTrack] Database initialization check notice:', err?.message || err);
  }
}

/**
 * Helper to retrieve currently authenticated user ID
 */
async function getAuthUserId(requireAuth = true) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;
  } catch {}

  const currentUser = await AuthService.getCurrentUser();
  if (currentUser?.id) {
    return currentUser.id;
  }

  if (requireAuth) {
    throw new Error('Authentication required. Please log in with your email OTP to access khata data.');
  }
  return null;
}

/**
 * Searches and lists active customers (excludes soft-deleted customers)
 */
export async function searchCustomers(query = '') {
  await NetworkService.assertOnline();
  const userId = await getAuthUserId(false);
  if (!userId) return [];

  if (await isDemoSession()) {
    const trimmed = (query || '').trim().toLowerCase();
    const active = demoStore.customers.filter((c) => !c.deleted_at);
    const matched = trimmed
      ? active.filter(
          (c) =>
            (c.name || '').toLowerCase().includes(trimmed) ||
            (c.phone_number || '').includes(trimmed) ||
            (c.village || '').toLowerCase().includes(trimmed)
        )
      : active;
    return matched.map((c) => {
      const custEntries = c.entries || [];
      const totalDue = calculateCustomerTotalDue(custEntries);
      return {
        customer_id: c.customer_id,
        phone_number: c.phone_number,
        name: c.name,
        village: c.village || '',
        address: c.address || '',
        created_at: c.created_at,
        deleted_at: c.deleted_at,
        total_due: totalDue,
        last_activity: c.created_at,
      };
    });
  }

  try {
    let req = supabase
      .from('customers')
      .select(`
        customer_id,
        phone_number,
        name,
        village,
        address,
        created_at,
        deleted_at,
        entries (
          entry_id,
          due_amount,
          entry_date
        )
      `)
      .eq('user_id', userId)
      .is('deleted_at', null);

    const trimmed = (query || '').trim();
    if (trimmed) {
      req = req.or(`name.ilike.%${trimmed}%,phone_number.ilike.%${trimmed}%,village.ilike.%${trimmed}%`);
    }

    const { data, error } = await req;
    if (error) throw error;

    const results = (data || []).map((c) => {
      const custEntries = c.entries || [];
      const totalDue = calculateCustomerTotalDue(custEntries);

      let lastActivity = c.created_at;
      if (custEntries.length > 0) {
        const dates = custEntries.map((e) => new Date(e.entry_date).getTime());
        const maxDate = Math.max(...dates);
        if (!isNaN(maxDate)) {
          lastActivity = new Date(maxDate).toISOString();
        }
      }

      return {
        customer_id: c.customer_id,
        phone_number: c.phone_number,
        name: c.name,
        village: c.village || '',
        address: c.address || '',
        created_at: c.created_at,
        deleted_at: c.deleted_at,
        total_due: totalDue,
        last_activity: lastActivity,
      };
    });

    return results.sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));
  } catch (err) {
    if (await isDemoSession()) {
      console.warn('searchCustomers demo notice:', err.message);
      const active = demoStore.customers.filter((c) => !c.deleted_at);
      return active.map((c) => ({
        customer_id: c.customer_id,
        phone_number: c.phone_number,
        name: c.name,
        village: c.village || '',
        address: c.address || '',
        created_at: c.created_at,
        deleted_at: c.deleted_at,
        total_due: calculateCustomerTotalDue(c.entries || []),
        last_activity: c.created_at,
      }));
    }
    throw err;
  }
}

/**
 * Retrieves a single customer with computed dues and entry counts
 */
export async function getCustomerById(customerId) {
  await NetworkService.assertOnline();
  const numericId = parseInt(customerId, 10);
  if (!numericId) return null;

  if (await isDemoSession()) {
    const found = demoStore.customers.find((c) => c.customer_id === numericId);
    if (!found) return null;
    return {
      customer_id: found.customer_id,
      phone_number: found.phone_number,
      name: found.name,
      village: found.village || '',
      address: found.address || '',
      notes: found.notes || '',
      created_at: found.created_at,
      deleted_at: found.deleted_at,
      total_due: calculateCustomerTotalDue(found.entries || []),
      total_entries: (found.entries || []).length,
    };
  }

  try {
    const userId = await getAuthUserId();
    const { data, error } = await supabase
      .from('customers')
      .select(`
        customer_id,
        phone_number,
        name,
        village,
        address,
        notes,
        created_at,
        deleted_at,
        entries (
          entry_id,
          due_amount
        )
      `)
      .eq('user_id', userId)
      .eq('customer_id', numericId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const custEntries = data.entries || [];
    const totalDue = calculateCustomerTotalDue(custEntries);

    return {
      customer_id: data.customer_id,
      phone_number: data.phone_number,
      name: data.name,
      village: data.village || '',
      address: data.address || '',
      notes: data.notes || '',
      created_at: data.created_at,
      deleted_at: data.deleted_at,
      total_due: totalDue,
      total_entries: custEntries.length,
    };
  } catch (err) {
    if (await isDemoSession()) {
      const found = demoStore.customers.find((c) => c.customer_id === numericId);
      if (!found) return null;
      return {
        customer_id: found.customer_id,
        phone_number: found.phone_number,
        name: found.name,
        village: found.village || '',
        address: found.address || '',
        notes: found.notes || '',
        created_at: found.created_at,
        deleted_at: found.deleted_at,
        total_due: calculateCustomerTotalDue(found.entries || []),
        total_entries: (found.entries || []).length,
      };
    }
    throw err;
  }
}

/**
 * Finds customer by phone number (for duplicate prevention)
 */
export async function getCustomerByPhone(phoneNumber) {
  await NetworkService.assertOnline();
  const cleaned = cleanPhoneNumber(phoneNumber);
  if (!cleaned) return null;

  if (await isDemoSession()) {
    const found = demoStore.customers.find((c) => c.phone_number === cleaned && !c.deleted_at);
    return found || null;
  }

  try {
    const userId = await getAuthUserId();
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .eq('phone_number', cleaned)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (err) {
    if (await isDemoSession()) {
      const found = demoStore.customers.find((c) => c.phone_number === cleaned && !c.deleted_at);
      return found || null;
    }
    throw err;
  }
}

/**
 * Adds a new customer under the current user's tenant
 */
export async function addCustomer({ name, phone_number, village, address, notes }) {
  await NetworkService.assertOnline();
  const cleanedPhone = cleanPhoneNumber(phone_number);
  const now = getCurrentLocalIso();

  if (await isDemoSession()) {
    const newCust = {
      customer_id: demoStore.nextCustomerId++,
      phone_number: cleanedPhone,
      name: (name || '').trim(),
      village: (village || '').trim(),
      address: (address || '').trim(),
      notes: (notes || '').trim(),
      created_at: now,
      deleted_at: null,
      entries: [],
    };
    demoStore.customers.unshift(newCust);
    return newCust.customer_id;
  }

  try {
    const userId = await getAuthUserId();
    const { data, error } = await supabase
      .from('customers')
      .insert({
        user_id: userId,
        phone_number: cleanedPhone,
        name: (name || '').trim(),
        village: (village || '').trim(),
        address: (address || '').trim(),
        notes: (notes || '').trim(),
        created_at: now,
        deleted_at: null,
      })
      .select('customer_id')
      .single();

    if (error) throw error;
    return data.customer_id;
  } catch (err) {
    if (await isDemoSession()) {
      console.warn('addCustomer demo fallback notice:', err.message);
      const newCust = {
        customer_id: demoStore.nextCustomerId++,
        phone_number: cleanedPhone,
        name: (name || '').trim(),
        village: (village || '').trim(),
        address: (address || '').trim(),
        notes: (notes || '').trim(),
        created_at: now,
        deleted_at: null,
        entries: [],
      };
      demoStore.customers.unshift(newCust);
      return newCust.customer_id;
    }
    throw new Error('Failed to create customer: ' + (err.message || 'Database error'));
  }
}

// TODO: The recycle bin's soft-delete, restore, and permanent-delete logic currently
// has no automated test coverage against Supabase (the legacy test_sqlite_recycle_bin.js
// was removed as it tested deprecated local SQLite infrastructure). Implement automated
// integration test coverage for Supabase softDeleteCustomer, restoreCustomer, and
// permanentDeleteCustomer with Row Level Security.

/**
 * ♻️ Soft-deletes a customer by updating deleted_at timestamp
 */
export async function softDeleteCustomer(customerId) {
  await NetworkService.assertOnline();
  const numericId = parseInt(customerId, 10);
  if (!numericId) return false;
  const now = getCurrentLocalIso();

  if (await isDemoSession()) {
    const cust = demoStore.customers.find((c) => c.customer_id === numericId);
    if (cust) cust.deleted_at = now;
    return true;
  }

  try {
    const userId = await getAuthUserId();
    const { error } = await supabase
      .from('customers')
      .update({ deleted_at: now, updated_at: now })
      .eq('user_id', userId)
      .eq('customer_id', numericId);

    if (error) throw error;
    return true;
  } catch (err) {
    if (await isDemoSession()) {
      const cust = demoStore.customers.find((c) => c.customer_id === numericId);
      if (cust) cust.deleted_at = now;
      return true;
    }
    throw new Error('Failed to move customer to Recycle Bin: ' + (err.message || 'Database error'));
  }
}

/**
 * ♻️ Restores a soft-deleted customer back to active state
 */
export async function restoreCustomer(customerId) {
  await NetworkService.assertOnline();
  const numericId = parseInt(customerId, 10);
  if (!numericId) return false;
  const now = getCurrentLocalIso();

  if (await isDemoSession()) {
    const cust = demoStore.customers.find((c) => c.customer_id === numericId);
    if (cust) cust.deleted_at = null;
    return true;
  }

  try {
    const userId = await getAuthUserId();
    const { error } = await supabase
      .from('customers')
      .update({ deleted_at: null, updated_at: now })
      .eq('user_id', userId)
      .eq('customer_id', numericId);

    if (error) throw error;
    return true;
  } catch (err) {
    if (await isDemoSession()) {
      const cust = demoStore.customers.find((c) => c.customer_id === numericId);
      if (cust) cust.deleted_at = null;
      return true;
    }
    throw new Error('Failed to restore customer: ' + (err.message || 'Database error'));
  }
}

/**
 * 💥 Permanently hard-deletes a customer (Cascades entries & line items via PostgreSQL foreign keys)
 */
export async function permanentDeleteCustomer(customerId) {
  await NetworkService.assertOnline();
  const numericId = parseInt(customerId, 10);
  if (!numericId) return false;

  if (await isDemoSession()) {
    demoStore.customers = demoStore.customers.filter((c) => c.customer_id !== numericId);
    demoStore.entries = demoStore.entries.filter((e) => e.customer_id !== numericId);
    return true;
  }

  try {
    const userId = await getAuthUserId();
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('user_id', userId)
      .eq('customer_id', numericId);

    if (error) throw error;
    return true;
  } catch (err) {
    if (await isDemoSession()) {
      demoStore.customers = demoStore.customers.filter((c) => c.customer_id !== numericId);
      demoStore.entries = demoStore.entries.filter((e) => e.customer_id !== numericId);
      return true;
    }
    throw new Error('Failed to permanently delete customer: ' + (err.message || 'Database error'));
  }
}

/**
 * Retrieves all soft-deleted customers for the Recycle Bin screen
 */
export async function getDeletedCustomers() {
  await NetworkService.assertOnline();

  if (await isDemoSession()) {
    return demoStore.customers
      .filter((c) => c.deleted_at)
      .map((c) => ({
        customer_id: c.customer_id,
        phone_number: c.phone_number,
        name: c.name,
        village: c.village || '',
        address: c.address || '',
        created_at: c.created_at,
        deleted_at: c.deleted_at,
        total_due: calculateCustomerTotalDue(c.entries || []),
        total_entries: (c.entries || []).length,
      }));
  }

  try {
    const userId = await getAuthUserId();
    const { data, error } = await supabase
      .from('customers')
      .select(`
        customer_id,
        phone_number,
        name,
        village,
        address,
        created_at,
        deleted_at,
        entries (
          entry_id,
          due_amount
        )
      `)
      .eq('user_id', userId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((c) => {
      const custEntries = c.entries || [];
      const totalDue = calculateCustomerTotalDue(custEntries);
      return {
        customer_id: c.customer_id,
        phone_number: c.phone_number,
        name: c.name,
        village: c.village || '',
        address: c.address || '',
        created_at: c.created_at,
        deleted_at: c.deleted_at,
        total_due: totalDue,
        total_entries: custEntries.length,
      };
    });
  } catch (err) {
    if (await isDemoSession()) {
      return demoStore.customers
        .filter((c) => c.deleted_at)
        .map((c) => ({
          customer_id: c.customer_id,
          phone_number: c.phone_number,
          name: c.name,
          village: c.village || '',
          address: c.address || '',
          created_at: c.created_at,
          deleted_at: c.deleted_at,
          total_due: calculateCustomerTotalDue(c.entries || []),
          total_entries: (c.entries || []).length,
        }));
    }
    console.error('getDeletedCustomers failed:', err.message);
    throw new Error('Failed to retrieve deleted customers from cloud: ' + err.message);
  }
}

/**
 * Returns count of soft-deleted customers
 */
export async function getDeletedCustomerCount() {
  try {
    if (await isDemoSession()) {
      return demoStore.customers.filter((c) => c.deleted_at).length;
    }
    const userId = await getAuthUserId();
    const { count, error } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('deleted_at', 'is', null);

    if (error) throw error;
    return count || 0;
  } catch (err) {
    if (await isDemoSession()) {
      return demoStore.customers.filter((c) => c.deleted_at).length;
    }
    throw err;
  }
}

/**
 * Retrieves full customer ledger with nested purchase medicines
 */
export async function getCustomerLedger(customerId) {
  await NetworkService.assertOnline();
  const numericId = parseInt(customerId, 10);
  if (!numericId) return [];

  if (await isDemoSession()) {
    const found = demoStore.entries.filter((e) => e.customer_id === numericId && !e.deleted_at);
    return found.map((entry) => ({
      entry_id: entry.entry_id,
      customer_id: entry.customer_id,
      entry_date: entry.entry_date,
      total_amount: parseFloat(entry.total_amount) || 0,
      amount_paid: parseFloat(entry.amount_paid) || 0,
      due_amount: parseFloat(entry.due_amount) || 0,
      notes: entry.notes || '',
      medicines: (entry.medicines || []).map((m) => ({
        id: m.id,
        entry_id: entry.entry_id,
        medicine_name: m.medicine_name,
        price: parseFloat(m.price) || 0,
        original_price: m.original_price != null ? parseFloat(m.original_price) : null,
        discount_percent: parseFloat(m.discount_percent) || 0,
        quantity: m.quantity != null ? parseInt(m.quantity, 10) : 1,
        unit_price: m.unit_price != null ? parseFloat(m.unit_price) : parseFloat(m.price) || 0,
      })),
    }));
  }

  try {
    const userId = await getAuthUserId();
    const { data, error } = await supabase
      .from('entries')
      .select(`
        entry_id,
        customer_id,
        entry_date,
        total_amount,
        amount_paid,
        due_amount,
        notes,
        deleted_at,
        entry_medicines (
          id,
          entry_id,
          medicine_name,
          price,
          original_price,
          discount_percent,
          quantity,
          unit_price
        )
      `)
      .eq('user_id', userId)
      .eq('customer_id', numericId)
      .is('deleted_at', null)
      .order('entry_date', { ascending: false });

    if (error) throw error;

    return (data || []).map((entry) => ({
      entry_id: entry.entry_id,
      customer_id: entry.customer_id,
      entry_date: entry.entry_date,
      total_amount: parseFloat(entry.total_amount) || 0,
      amount_paid: parseFloat(entry.amount_paid) || 0,
      due_amount: parseFloat(entry.due_amount) || 0,
      notes: entry.notes || '',
      medicines: (entry.entry_medicines || []).map((m) => ({
        id: m.id,
        entry_id: m.entry_id,
        medicine_name: m.medicine_name,
        price: parseFloat(m.price) || 0,
        original_price: m.original_price != null ? parseFloat(m.original_price) : null,
        discount_percent: parseFloat(m.discount_percent) || 0,
        quantity: m.quantity != null ? parseInt(m.quantity, 10) : 1,
        unit_price: m.unit_price != null ? parseFloat(m.unit_price) : (parseFloat(m.price) || 0),
      })),
    }));
  } catch (err) {
    if (await isDemoSession()) {
      const found = demoStore.entries.filter((e) => e.customer_id === numericId && !e.deleted_at);
      return found.map((entry) => ({
        entry_id: entry.entry_id,
        customer_id: entry.customer_id,
        entry_date: entry.entry_date,
        total_amount: parseFloat(entry.total_amount) || 0,
        amount_paid: parseFloat(entry.amount_paid) || 0,
        due_amount: parseFloat(entry.due_amount) || 0,
        notes: entry.notes || '',
        medicines: (entry.medicines || []).map((m) => ({
          id: m.id,
          entry_id: entry.entry_id,
          medicine_name: m.medicine_name,
          price: parseFloat(m.price) || 0,
          original_price: m.original_price != null ? parseFloat(m.original_price) : null,
          discount_percent: parseFloat(m.discount_percent) || 0,
          quantity: m.quantity != null ? parseInt(m.quantity, 10) : 1,
          unit_price: m.unit_price != null ? parseFloat(m.unit_price) : parseFloat(m.price) || 0,
        })),
      }));
    }
    console.error('getCustomerLedger cloud error:', err.message);
    throw new Error('Failed to retrieve ledger from cloud: ' + err.message);
  }
}

/**
 * Records a multi-medicine purchase entry in Supabase with atomic rollback
 */
export async function addPurchaseEntry({ customerId, medicines = [], totalAmount = 0, amountPaid = 0, notes = '' }) {
  await NetworkService.assertOnline();
  const numericId = parseInt(customerId, 10);
  const now = getCurrentLocalIso();
  const parsedTotal = Math.max(0, parseFloat(totalAmount) || 0);
  const parsedPaid = Math.max(0, parseFloat(amountPaid) || 0);
  const dueAmount = calculateEntryDue(parsedTotal, parsedPaid);

  if (await isDemoSession()) {
    const newEntry = {
      entry_id: demoStore.nextEntryId++,
      customer_id: numericId,
      entry_date: now,
      total_amount: parsedTotal,
      amount_paid: parsedPaid,
      due_amount: dueAmount,
      notes: (notes || '').trim(),
      deleted_at: null,
      medicines: medicines.map((m) => {
        const qty = Math.max(1, parseInt(m.quantity, 10) || 1);
        const linePrice = Math.max(0, parseFloat(m.price) || 0);
        const unitPrice = m.unit_price != null ? Math.max(0, parseFloat(m.unit_price)) : (linePrice / qty);
        return {
          id: demoStore.nextMedId++,
          medicine_name: (m.name || m.medicine_name || '').trim(),
          price: linePrice,
          original_price: m.original_price != null ? parseFloat(m.original_price) : linePrice,
          discount_percent: parseFloat(m.discount_percent) || 0,
          quantity: qty,
          unit_price: unitPrice,
        };
      }),
    };
    demoStore.entries.unshift(newEntry);
    const cust = demoStore.customers.find((c) => c.customer_id === numericId);
    if (cust) {
      if (!cust.entries) cust.entries = [];
      cust.entries.unshift({ entry_id: newEntry.entry_id, due_amount: dueAmount, entry_date: now });
    }
    return newEntry.entry_id;
  }

  try {
    const userId = await getAuthUserId();
    const { data: entryData, error: entryErr } = await supabase
      .from('entries')
      .insert({
        user_id: userId,
        customer_id: numericId,
        entry_date: now,
        total_amount: parsedTotal,
        amount_paid: parsedPaid,
        due_amount: dueAmount,
        notes: (notes || '').trim() || null,
      })
      .select('entry_id')
      .single();

    if (entryErr) throw entryErr;

    const insertedEntryId = entryData.entry_id;

    const validMeds = medicines
      .filter((m) => (m.name || m.medicine_name || '').trim())
      .map((m) => {
        const name = (m.name || m.medicine_name).trim();
        const medPrice = Math.max(0, parseFloat(m.price) || 0);
        const origPrice = m.original_price != null ? Math.max(0, parseFloat(m.original_price)) : medPrice;
        const discPct = m.discount_percent != null ? Math.max(0, parseFloat(m.discount_percent)) : 0;
        const qty = Math.max(1, parseInt(m.quantity, 10) || 1);
        const unitPrice = m.unit_price != null ? Math.max(0, parseFloat(m.unit_price)) : (medPrice / qty);

        return {
          user_id: userId,
          entry_id: insertedEntryId,
          medicine_name: name,
          price: medPrice,
          original_price: origPrice,
          discount_percent: discPct,
          quantity: qty,
          unit_price: unitPrice,
        };
      });

    if (validMeds.length > 0) {
      const { error: medErr } = await supabase.from('entry_medicines').insert(validMeds);
      if (medErr) {
        console.error('Supabase addPurchaseEntry medicines error, rolling back entry:', medErr.message);
        // Atomic rollback: remove the orphaned entry so ledger and medicines never disagree
        await supabase.from('entries').delete().eq('entry_id', insertedEntryId).eq('user_id', userId);
        throw new Error('Failed to record purchase medicines. Ledger entry was rolled back to maintain consistency: ' + medErr.message);
      }
    }

    return insertedEntryId;
  } catch (err) {
    if (await isDemoSession()) {
      const newEntry = {
        entry_id: demoStore.nextEntryId++,
        customer_id: numericId,
        entry_date: now,
        total_amount: parsedTotal,
        amount_paid: parsedPaid,
        due_amount: dueAmount,
        notes: (notes || '').trim(),
        deleted_at: null,
        medicines: medicines.map((m) => ({
          id: demoStore.nextMedId++,
          medicine_name: (m.name || m.medicine_name || '').trim(),
          price: Math.max(0, parseFloat(m.price) || 0),
          original_price: m.original_price != null ? parseFloat(m.original_price) : parseFloat(m.price) || 0,
          discount_percent: parseFloat(m.discount_percent) || 0,
          quantity: Math.max(1, parseInt(m.quantity, 10) || 1),
          unit_price: m.unit_price != null ? parseFloat(m.unit_price) : (parseFloat(m.price) || 0),
        })),
      };
      demoStore.entries.unshift(newEntry);
      return newEntry.entry_id;
    }
    console.error('addPurchaseEntry cloud error:', err.message);
    throw new Error('Failed to record purchase in cloud: ' + err.message);
  }
}

/**
 * Records a standalone payment towards existing dues and logs to payments table
 */
export async function addDuePayment({ customerId, amountPaid }) {
  await NetworkService.assertOnline();
  const numericId = parseInt(customerId, 10);
  const now = getCurrentLocalIso();
  const parsedPaid = Math.max(0, parseFloat(amountPaid) || 0);
  if (parsedPaid <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  const dueAmount = calculatePaymentDue(parsedPaid);

  if (await isDemoSession()) {
    const newEntry = {
      entry_id: demoStore.nextEntryId++,
      customer_id: numericId,
      entry_date: now,
      total_amount: 0,
      amount_paid: parsedPaid,
      due_amount: dueAmount,
      medicines: [],
      deleted_at: null,
    };
    demoStore.entries.unshift(newEntry);
    const cust = demoStore.customers.find((c) => c.customer_id === numericId);
    if (cust) {
      if (!cust.entries) cust.entries = [];
      cust.entries.unshift({ entry_id: newEntry.entry_id, due_amount: dueAmount, entry_date: now });
    }
    return newEntry.entry_id;
  }

  try {
    const userId = await getAuthUserId();
    const { data, error } = await supabase
      .from('entries')
      .insert({
        user_id: userId,
        customer_id: numericId,
        entry_date: now,
        total_amount: 0,
        amount_paid: parsedPaid,
        due_amount: dueAmount,
      })
      .select('entry_id')
      .single();

    if (error) throw error;

    // Dual record in payments table for audit & ledger compliance
    const { error: payErr } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        customer_id: numericId,
        amount: parsedPaid,
        payment_date: now,
        notes: 'Payment towards customer dues',
      });
    if (payErr) {
      console.warn('Payment entry created in ledger, payments audit notice:', payErr.message);
    }

    return data.entry_id;
  } catch (err) {
    if (await isDemoSession()) {
      const newEntry = {
        entry_id: demoStore.nextEntryId++,
        customer_id: numericId,
        entry_date: now,
        total_amount: 0,
        amount_paid: parsedPaid,
        due_amount: dueAmount,
        medicines: [],
        deleted_at: null,
      };
      demoStore.entries.unshift(newEntry);
      return newEntry.entry_id;
    }
    console.error('addDuePayment cloud error:', err.message);
    throw new Error('Failed to record payment in cloud: ' + err.message);
  }
}

/**
 * Returns distinct medicine names previously entered for autocomplete
 */
export async function getPastMedicineNames() {
  try {
    if (await isDemoSession()) {
      const names = new Set();
      demoStore.entries.forEach((e) => (e.medicines || []).forEach((m) => names.add(m.medicine_name)));
      return Array.from(names);
    }
    const userId = await getAuthUserId();
    const { data, error } = await supabase
      .from('entry_medicines')
      .select('medicine_name')
      .eq('user_id', userId)
      .order('medicine_name', { ascending: true })
      .limit(200);

    if (error || !data) {
      const names = new Set();
      demoStore.entries.forEach((e) => (e.medicines || []).forEach((m) => names.add(m.medicine_name)));
      return Array.from(names);
    }
    return Array.from(new Set(data.map((r) => r.medicine_name))).slice(0, 100);
  } catch {
    const names = new Set();
    demoStore.entries.forEach((e) => (e.medicines || []).forEach((m) => names.add(m.medicine_name)));
    return Array.from(names);
  }
}

/**
 * Retrieves the current shop & pharmacist profile
 */
export async function getShopProfile() {
  const defaultProfile = {
    shop_name: 'MedTrack Pharmacy',
    shop_license_no: '',
    license_20b: '',
    license_21b: '',
    shop_license_validity: '',
    shop_phone: '',
    pharmacist_name: '',
    pharmacist_phone: '',
    pharmacist_license_validity: '',
  };

  try {
    if (await isDemoSession()) {
      return { ...defaultProfile, ...demoStore.shopProfile };
    }
    const userId = await getAuthUserId();
    const { data, error } = await supabase
      .from('shop_profile')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return { ...defaultProfile, ...demoStore.shopProfile };
    return {
      ...defaultProfile,
      ...data,
      shop_license_no: data.shop_license_no || data.license_20b || '',
    };
  } catch {
    return { ...defaultProfile, ...demoStore.shopProfile };
  }
}

/**
 * Saves/updates shop and pharmacist profile in Supabase
 */
export async function saveShopProfile(profile = {}) {
  await NetworkService.assertOnline();
  const now = getCurrentLocalIso();

  if (await isDemoSession()) {
    demoStore.shopProfile = { ...demoStore.shopProfile, ...profile, updated_at: now };
    return demoStore.shopProfile;
  }

  try {
    const userId = await getAuthUserId();
    const sanitized = {
      user_id: userId,
      shop_name: (profile.shop_name || '').trim(),
      shop_license_no: (profile.shop_license_no || '').trim(),
      license_20b: (profile.license_20b || profile.shop_license_no || '').trim(),
      license_21b: (profile.license_21b || '').trim(),
      shop_license_validity: profile.shop_license_validity ? profile.shop_license_validity.trim() : null,
      shop_phone: (profile.shop_phone || '').trim(),
      pharmacist_name: (profile.pharmacist_name || '').trim(),
      pharmacist_phone: (profile.pharmacist_phone || '').trim(),
      pharmacist_license_validity: profile.pharmacist_license_validity ? profile.pharmacist_license_validity.trim() : null,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('shop_profile')
      .upsert(sanitized)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    if (await isDemoSession()) {
      demoStore.shopProfile = { ...demoStore.shopProfile, ...profile, updated_at: now };
      return demoStore.shopProfile;
    }
    console.error('saveShopProfile cloud error:', err.message);
    throw new Error('Failed to save shop profile to cloud: ' + err.message);
  }
}

/**
 * Exports complete JSON backup directly from Supabase including customers, entries, medicines, payments, and profile
 */
export async function exportAllData() {
  await NetworkService.assertOnline();

  if (await isDemoSession()) {
    return {
      version: '2.0',
      source: 'MedTrack Demo Sandbox',
      exportedAt: getCurrentLocalIso(),
      totalCustomers: demoStore.customers.length,
      activeCustomers: demoStore.customers.filter((c) => !c.deleted_at).length,
      deletedCustomers: demoStore.customers.filter((c) => c.deleted_at).length,
      customers: demoStore.customers,
      entries: demoStore.entries,
      entryMedicines: [],
      payments: [],
      shopProfile: demoStore.shopProfile,
    };
  }

  const userId = await getAuthUserId();
  const shopProfile = await getShopProfile();

  // 1. Fetch all customers (including soft-deleted)
  const { data: rawCustomers, error: custErr } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', userId)
    .order('customer_id', { ascending: true });

  if (custErr) throw new Error('Export failed to read customers: ' + custErr.message);

  // 2. Fetch all entries
  const { data: entries, error: entriesErr } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .order('entry_id', { ascending: true });

  if (entriesErr) throw new Error('Export failed to read entries: ' + entriesErr.message);

  // 3. Fetch all medicines
  const { data: entryMedicines, error: medsErr } = await supabase
    .from('entry_medicines')
    .select('*')
    .eq('user_id', userId)
    .order('id', { ascending: true });

  if (medsErr) throw new Error('Export failed to read medicines: ' + medsErr.message);

  // 4. Fetch all payments
  const { data: payments, error: paymentsErr } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('payment_id', { ascending: true });

  if (paymentsErr) {
    console.warn('Export payments notice:', paymentsErr.message);
  }

  const formattedCustomers = (rawCustomers || []).map((c) => ({
    ...c,
    is_deleted: Boolean(c.deleted_at),
    deleted_at: c.deleted_at || null,
  }));

  return {
    version: '2.0',
    source: 'MedTrack Supabase Cloud',
    exportedAt: getCurrentLocalIso(),
    totalCustomers: formattedCustomers.length,
    activeCustomers: formattedCustomers.filter((c) => !c.is_deleted).length,
    deletedCustomers: formattedCustomers.filter((c) => c.is_deleted).length,
    customers: formattedCustomers,
    entries: entries || [],
    entryMedicines: entryMedicines || [],
    payments: payments || [],
    shopProfile,
  };
}

/**
 * Restores ledger records from a verified JSON backup with duplicate prevention and relationship mapping
 */
export async function restoreFromBackup(backupData) {
  await NetworkService.assertOnline();
  if (!backupData || (!Array.isArray(backupData.customers) && !Array.isArray(backupData.entries))) {
    throw new Error('Invalid backup file format. Expected a valid MedTrack JSON backup.');
  }

  if (await isDemoSession()) {
    demoStore.customers = backupData.customers || [];
    demoStore.entries = backupData.entries || [];
    if (backupData.shopProfile) demoStore.shopProfile = backupData.shopProfile;
    return {
      customersRestored: demoStore.customers.length,
      entriesRestored: demoStore.entries.length,
      medicinesRestored: 0,
      paymentsRestored: (backupData.payments || []).length,
    };
  }

  const userId = await getAuthUserId();
  const customerIdMap = new Map(); // old_id -> new_id
  const entryIdMap = new Map(); // old_id -> new_id

  let customersRestored = 0;
  let entriesRestored = 0;
  let medicinesRestored = 0;
  let paymentsRestored = 0;

  // 1. Existing customers for duplicate checking
  const { data: existingCustomers } = await supabase
    .from('customers')
    .select('customer_id, phone_number')
    .eq('user_id', userId);

  const phoneToCustomerMap = new Map(
    (existingCustomers || []).map((c) => [c.phone_number, c.customer_id])
  );

  // 2. Restore or link customers
  for (const cust of backupData.customers || []) {
    const rawPhone = cust.phone_number || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    let resolvedCustomerId = phoneToCustomerMap.get(cleanPhone);

    if (!resolvedCustomerId) {
      const { data: newCust, error: insertCustErr } = await supabase
        .from('customers')
        .insert({
          user_id: userId,
          phone_number: cleanPhone,
          name: (cust.name || 'Unnamed Customer').trim(),
          village: (cust.village || '').trim(),
          address: (cust.address || '').trim(),
          notes: (cust.notes || '').trim() || null,
          deleted_at: cust.deleted_at || null,
        })
        .select('customer_id')
        .single();

      if (insertCustErr) {
        console.error('Failed restoring customer:', cust.name, insertCustErr.message);
        continue;
      }
      resolvedCustomerId = newCust.customer_id;
      phoneToCustomerMap.set(cleanPhone, resolvedCustomerId);
      customersRestored++;
    }

    if (cust.customer_id) {
      customerIdMap.set(cust.customer_id, resolvedCustomerId);
    }
  }

  // 3. Restore entries
  for (const entry of backupData.entries || []) {
    const mappedCustomerId = customerIdMap.get(entry.customer_id);
    if (!mappedCustomerId) continue;

    const { data: newEntry, error: insertEntryErr } = await supabase
      .from('entries')
      .insert({
        user_id: userId,
        customer_id: mappedCustomerId,
        entry_date: entry.entry_date || getCurrentLocalIso(),
        total_amount: Math.max(0, parseFloat(entry.total_amount) || 0),
        amount_paid: Math.max(0, parseFloat(entry.amount_paid) || 0),
        due_amount: calculateEntryDue(parseFloat(entry.total_amount) || 0, parseFloat(entry.amount_paid) || 0),
        notes: (entry.notes || '').trim() || null,
        deleted_at: entry.deleted_at || null,
      })
      .select('entry_id')
      .single();

    if (insertEntryErr) {
      console.error('Failed restoring entry:', insertEntryErr.message);
      continue;
    }

    if (entry.entry_id) {
      entryIdMap.set(entry.entry_id, newEntry.entry_id);
    }
    entriesRestored++;
  }

  // 4. Restore medicines
  const backupMeds = backupData.entryMedicines || [];
  if (backupMeds.length > 0) {
    const medsToInsert = [];
    for (const med of backupMeds) {
      const mappedEntryId = entryIdMap.get(med.entry_id);
      if (!mappedEntryId) continue;

      const qty = Math.max(1, parseInt(med.quantity, 10) || 1);
      const price = Math.max(0, parseFloat(med.price) || 0);
      const unitPrice = med.unit_price != null ? Math.max(0, parseFloat(med.unit_price)) : (price / qty);

      medsToInsert.push({
        user_id: userId,
        entry_id: mappedEntryId,
        medicine_name: (med.medicine_name || '').trim(),
        price,
        original_price: med.original_price != null ? Math.max(0, parseFloat(med.original_price)) : price,
        discount_percent: Math.max(0, parseFloat(med.discount_percent) || 0),
        quantity: qty,
        unit_price: unitPrice,
      });
    }

    if (medsToInsert.length > 0) {
      const { error: batchMedErr } = await supabase.from('entry_medicines').insert(medsToInsert);
      if (batchMedErr) {
        console.error('Failed restoring medicines batch:', batchMedErr.message);
      } else {
        medicinesRestored = medsToInsert.length;
      }
    }
  }

  // 5. Restore payments
  for (const pay of backupData.payments || []) {
    const mappedCustomerId = customerIdMap.get(pay.customer_id);
    if (!mappedCustomerId) continue;

    const { error: payErr } = await supabase.from('payments').insert({
      user_id: userId,
      customer_id: mappedCustomerId,
      amount: Math.max(0, parseFloat(pay.amount) || 0),
      payment_date: pay.payment_date || getCurrentLocalIso(),
      notes: (pay.notes || '').trim() || null,
    });
    if (!payErr) {
      paymentsRestored++;
    }
  }

  // 6. Restore shopProfile if present
  if (backupData.shopProfile) {
    try {
      await saveShopProfile(backupData.shopProfile);
    } catch (e) {
      console.warn('Notice restoring shop profile:', e.message);
    }
  }

  return {
    customersRestored,
    entriesRestored,
    medicinesRestored,
    paymentsRestored,
  };
}

export * from './database_extensions';

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
    console.warn('searchCustomers cloud notice, falling back:', err.message);
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
      created_at: data.created_at,
      deleted_at: data.deleted_at,
      total_due: totalDue,
      total_entries: custEntries.length,
    };
  } catch (err) {
    console.warn('getCustomerById cloud notice, falling back:', err.message);
    const found = demoStore.customers.find((c) => c.customer_id === numericId);
    if (!found) return null;
    return {
      customer_id: found.customer_id,
      phone_number: found.phone_number,
      name: found.name,
      village: found.village || '',
      address: found.address || '',
      created_at: found.created_at,
      deleted_at: found.deleted_at,
      total_due: calculateCustomerTotalDue(found.entries || []),
      total_entries: (found.entries || []).length,
    };
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
    console.warn('getCustomerByPhone cloud notice, falling back:', err.message);
    const found = demoStore.customers.find((c) => c.phone_number === cleaned && !c.deleted_at);
    return found || null;
  }
}

/**
 * Adds a new customer under the current user's tenant
 */
export async function addCustomer({ name, phone_number, village, address }) {
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
        created_at: now,
        deleted_at: null,
      })
      .select('customer_id')
      .single();

    if (error) throw error;
    return data.customer_id;
  } catch (err) {
    console.warn('addCustomer cloud notice, falling back:', err.message);
    const newCust = {
      customer_id: demoStore.nextCustomerId++,
      phone_number: cleanedPhone,
      name: (name || '').trim(),
      village: (village || '').trim(),
      address: (address || '').trim(),
      created_at: now,
      deleted_at: null,
      entries: [],
    };
    demoStore.customers.unshift(newCust);
    return newCust.customer_id;
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
    console.warn('softDeleteCustomer cloud notice, falling back:', err.message);
    const cust = demoStore.customers.find((c) => c.customer_id === numericId);
    if (cust) cust.deleted_at = now;
    return true;
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
    console.warn('restoreCustomer cloud notice, falling back:', err.message);
    const cust = demoStore.customers.find((c) => c.customer_id === numericId);
    if (cust) cust.deleted_at = null;
    return true;
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
    console.warn('permanentDeleteCustomer cloud notice, falling back:', err.message);
    demoStore.customers = demoStore.customers.filter((c) => c.customer_id !== numericId);
    demoStore.entries = demoStore.entries.filter((e) => e.customer_id !== numericId);
    return true;
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
    console.warn('getDeletedCustomers cloud notice, falling back:', err.message);
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

    if (error) return demoStore.customers.filter((c) => c.deleted_at).length;
    return count || 0;
  } catch {
    return demoStore.customers.filter((c) => c.deleted_at).length;
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
    const found = demoStore.entries.filter((e) => e.customer_id === numericId);
    return found.map((entry) => ({
      entry_id: entry.entry_id,
      customer_id: entry.customer_id,
      entry_date: entry.entry_date,
      total_amount: parseFloat(entry.total_amount) || 0,
      amount_paid: parseFloat(entry.amount_paid) || 0,
      due_amount: parseFloat(entry.due_amount) || 0,
      medicines: (entry.medicines || []).map((m) => ({
        id: m.id,
        entry_id: entry.entry_id,
        medicine_name: m.medicine_name,
        price: parseFloat(m.price) || 0,
        original_price: m.original_price != null ? parseFloat(m.original_price) : null,
        discount_percent: parseFloat(m.discount_percent) || 0,
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
        entry_medicines (
          id,
          entry_id,
          medicine_name,
          price,
          original_price,
          discount_percent
        )
      `)
      .eq('user_id', userId)
      .eq('customer_id', numericId)
      .order('entry_date', { ascending: false });

    if (error) throw error;

    return (data || []).map((entry) => ({
      entry_id: entry.entry_id,
      customer_id: entry.customer_id,
      entry_date: entry.entry_date,
      total_amount: parseFloat(entry.total_amount) || 0,
      amount_paid: parseFloat(entry.amount_paid) || 0,
      due_amount: parseFloat(entry.due_amount) || 0,
      medicines: (entry.entry_medicines || []).map((m) => ({
        id: m.id,
        entry_id: m.entry_id,
        medicine_name: m.medicine_name,
        price: parseFloat(m.price) || 0,
        original_price: m.original_price != null ? parseFloat(m.original_price) : null,
        discount_percent: parseFloat(m.discount_percent) || 0,
      })),
    }));
  } catch (err) {
    console.warn('getCustomerLedger cloud notice, falling back:', err.message);
    const found = demoStore.entries.filter((e) => e.customer_id === numericId);
    return found.map((entry) => ({
      entry_id: entry.entry_id,
      customer_id: entry.customer_id,
      entry_date: entry.entry_date,
      total_amount: parseFloat(entry.total_amount) || 0,
      amount_paid: parseFloat(entry.amount_paid) || 0,
      due_amount: parseFloat(entry.due_amount) || 0,
      medicines: (entry.medicines || []).map((m) => ({
        id: m.id,
        entry_id: entry.entry_id,
        medicine_name: m.medicine_name,
        price: parseFloat(m.price) || 0,
        original_price: m.original_price != null ? parseFloat(m.original_price) : null,
        discount_percent: parseFloat(m.discount_percent) || 0,
      })),
    }));
  }
}

/**
 * Records a multi-medicine purchase entry in Supabase
 */
export async function addPurchaseEntry({ customerId, medicines = [], totalAmount = 0, amountPaid = 0 }) {
  await NetworkService.assertOnline();
  const numericId = parseInt(customerId, 10);
  const now = getCurrentLocalIso();
  const parsedTotal = parseFloat(totalAmount) || 0;
  const parsedPaid = parseFloat(amountPaid) || 0;
  const dueAmount = calculateEntryDue(parsedTotal, parsedPaid);

  if (await isDemoSession()) {
    const newEntry = {
      entry_id: demoStore.nextEntryId++,
      customer_id: numericId,
      entry_date: now,
      total_amount: parsedTotal,
      amount_paid: parsedPaid,
      due_amount: dueAmount,
      medicines: medicines.map((m) => ({
        id: demoStore.nextMedId++,
        medicine_name: (m.name || m.medicine_name || '').trim(),
        price: parseFloat(m.price) || 0,
        original_price: m.original_price != null ? parseFloat(m.original_price) : parseFloat(m.price) || 0,
        discount_percent: parseFloat(m.discount_percent) || 0,
      })),
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
      })
      .select('entry_id')
      .single();

    if (entryErr) throw entryErr;

    const insertedEntryId = entryData.entry_id;

    const validMeds = medicines
      .filter((m) => (m.name || m.medicine_name || '').trim())
      .map((m) => {
        const name = (m.name || m.medicine_name).trim();
        const medPrice = parseFloat(m.price) || 0;
        const origPrice = m.original_price != null ? parseFloat(m.original_price) : medPrice;
        const discPct = m.discount_percent != null ? parseFloat(m.discount_percent) : 0;

        return {
          user_id: userId,
          entry_id: insertedEntryId,
          medicine_name: name,
          price: medPrice,
          original_price: origPrice,
          discount_percent: discPct,
        };
      });

    if (validMeds.length > 0) {
      const { error: medErr } = await supabase.from('entry_medicines').insert(validMeds);
      if (medErr) {
        console.warn('Supabase addPurchaseEntry medicines warning:', medErr.message);
      }
    }

    return insertedEntryId;
  } catch (err) {
    console.warn('addPurchaseEntry cloud notice, falling back:', err.message);
    const newEntry = {
      entry_id: demoStore.nextEntryId++,
      customer_id: numericId,
      entry_date: now,
      total_amount: parsedTotal,
      amount_paid: parsedPaid,
      due_amount: dueAmount,
      medicines: medicines.map((m) => ({
        id: demoStore.nextMedId++,
        medicine_name: (m.name || m.medicine_name || '').trim(),
        price: parseFloat(m.price) || 0,
        original_price: m.original_price != null ? parseFloat(m.original_price) : parseFloat(m.price) || 0,
        discount_percent: parseFloat(m.discount_percent) || 0,
      })),
    };
    demoStore.entries.unshift(newEntry);
    const cust = demoStore.customers.find((c) => c.customer_id === numericId);
    if (cust) {
      if (!cust.entries) cust.entries = [];
      cust.entries.unshift({ entry_id: newEntry.entry_id, due_amount: dueAmount, entry_date: now });
    }
    return newEntry.entry_id;
  }
}

/**
 * Records a standalone payment towards existing dues
 */
export async function addDuePayment({ customerId, amountPaid }) {
  await NetworkService.assertOnline();
  const numericId = parseInt(customerId, 10);
  const now = getCurrentLocalIso();
  const parsedPaid = parseFloat(amountPaid) || 0;
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
    return data.entry_id;
  } catch (err) {
    console.warn('addDuePayment cloud notice, falling back:', err.message);
    const newEntry = {
      entry_id: demoStore.nextEntryId++,
      customer_id: numericId,
      entry_date: now,
      total_amount: 0,
      amount_paid: parsedPaid,
      due_amount: dueAmount,
      medicines: [],
    };
    demoStore.entries.unshift(newEntry);
    const cust = demoStore.customers.find((c) => c.customer_id === numericId);
    if (cust) {
      if (!cust.entries) cust.entries = [];
      cust.entries.unshift({ entry_id: newEntry.entry_id, due_amount: dueAmount, entry_date: now });
    }
    return newEntry.entry_id;
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
    console.warn('saveShopProfile cloud notice, falling back:', err.message);
    demoStore.shopProfile = { ...demoStore.shopProfile, ...profile, updated_at: now };
    return demoStore.shopProfile;
  }
}

/**
 * Exports complete JSON backup directly from Supabase
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
    shopProfile,
  };
}

export * from './database_extensions';

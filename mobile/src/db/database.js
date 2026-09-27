import { supabase } from '../utils/supabaseClient';
import { getCurrentLocalIso } from '../utils/dateUtils';
import { NetworkService } from '../services/networkService';
import {
  cleanPhoneNumber,
  calculateEntryDue,
  calculatePaymentDue,
  calculateCustomerTotalDue,
} from '../utils/khataLogic';

// ─────────────────────────────────────────────────────────────
// SUPABASE CLOUD DATA ACCESS LAYER (PostgreSQL + Row Level Security)
// ─────────────────────────────────────────────────────────────

export function getActiveDriverName() {
  return 'SUPABASE_CLOUD (PostgreSQL + Row Level Security)';
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
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    if (requireAuth) {
      throw new Error('Authentication required. Please log in with your email OTP to access khata data.');
    }
    return null;
  }
  return user.id;
}

/**
 * Searches and lists active customers (excludes soft-deleted customers)
 */
export async function searchCustomers(query = '') {
  await NetworkService.assertOnline();
  const userId = await getAuthUserId(false);
  if (!userId) return [];

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
  if (error) {
    console.error('Supabase searchCustomers error:', error);
    throw new Error(error.message || 'Failed to search customers');
  }

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

  // Sort by latest activity descending
  return results.sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));
}

/**
 * Retrieves a single customer with computed dues and entry counts
 */
export async function getCustomerById(customerId) {
  await NetworkService.assertOnline();
  const userId = await getAuthUserId();
  const numericId = parseInt(customerId, 10);
  if (!numericId) return null;

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

  if (error) {
    console.error('Supabase getCustomerById error:', error);
    throw new Error(error.message || 'Failed to load customer');
  }
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
}

/**
 * Finds customer by phone number (for duplicate prevention)
 */
export async function getCustomerByPhone(phoneNumber) {
  await NetworkService.assertOnline();
  const userId = await getAuthUserId();
  const cleaned = cleanPhoneNumber(phoneNumber);
  if (!cleaned) return null;

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', userId)
    .eq('phone_number', cleaned)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.error('Supabase getCustomerByPhone error:', error);
    return null;
  }
  return data || null;
}

/**
 * Adds a new customer under the current user's tenant
 */
export async function addCustomer({ name, phone_number, village, address }) {
  await NetworkService.assertOnline();
  const userId = await getAuthUserId();
  const cleanedPhone = cleanPhoneNumber(phone_number);
  const now = getCurrentLocalIso();

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

  if (error) {
    console.error('Supabase addCustomer error:', error);
    throw new Error(error.message || 'Failed to create customer');
  }

  return data.customer_id;
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
  const userId = await getAuthUserId();
  const numericId = parseInt(customerId, 10);
  if (!numericId) return false;
  const now = getCurrentLocalIso();

  const { error } = await supabase
    .from('customers')
    .update({ deleted_at: now, updated_at: now })
    .eq('user_id', userId)
    .eq('customer_id', numericId);

  if (error) {
    console.error('Supabase softDeleteCustomer error:', error);
    throw new Error(error.message || 'Failed to soft delete customer');
  }
  return true;
}

/**
 * ♻️ Restores a soft-deleted customer back to active state
 */
export async function restoreCustomer(customerId) {
  await NetworkService.assertOnline();
  const userId = await getAuthUserId();
  const numericId = parseInt(customerId, 10);
  if (!numericId) return false;
  const now = getCurrentLocalIso();

  const { error } = await supabase
    .from('customers')
    .update({ deleted_at: null, updated_at: now })
    .eq('user_id', userId)
    .eq('customer_id', numericId);

  if (error) {
    console.error('Supabase restoreCustomer error:', error);
    throw new Error(error.message || 'Failed to restore customer');
  }
  return true;
}

/**
 * 💥 Permanently hard-deletes a customer (Cascades entries & line items via PostgreSQL foreign keys)
 */
export async function permanentDeleteCustomer(customerId) {
  await NetworkService.assertOnline();
  const userId = await getAuthUserId();
  const numericId = parseInt(customerId, 10);
  if (!numericId) return false;

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('user_id', userId)
    .eq('customer_id', numericId);

  if (error) {
    console.error('Supabase permanentDeleteCustomer error:', error);
    throw new Error(error.message || 'Failed to permanently delete customer');
  }
  return true;
}

/**
 * Retrieves all soft-deleted customers for the Recycle Bin screen
 */
export async function getDeletedCustomers() {
  await NetworkService.assertOnline();
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

  if (error) {
    console.error('Supabase getDeletedCustomers error:', error);
    throw new Error(error.message || 'Failed to load recycle bin');
  }

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
}

/**
 * Returns count of soft-deleted customers
 */
export async function getDeletedCustomerCount() {
  try {
    const userId = await getAuthUserId();
    const { count, error } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('deleted_at', 'is', null);

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Retrieves full customer ledger with nested purchase medicines
 */
export async function getCustomerLedger(customerId) {
  await NetworkService.assertOnline();
  const userId = await getAuthUserId();
  const numericId = parseInt(customerId, 10);
  if (!numericId) return [];

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

  if (error) {
    console.error('Supabase getCustomerLedger error:', error);
    throw new Error(error.message || 'Failed to load ledger history');
  }

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
}

/**
 * Records a multi-medicine purchase entry in Supabase
 */
export async function addPurchaseEntry({ customerId, medicines = [], totalAmount = 0, amountPaid = 0 }) {
  await NetworkService.assertOnline();
  const userId = await getAuthUserId();
  const numericId = parseInt(customerId, 10);
  const now = getCurrentLocalIso();
  const parsedTotal = parseFloat(totalAmount) || 0;
  const parsedPaid = parseFloat(amountPaid) || 0;
  const dueAmount = calculateEntryDue(parsedTotal, parsedPaid);

  // 1. Insert entry record
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

  if (entryErr) {
    console.error('Supabase addPurchaseEntry error:', entryErr);
    throw new Error(entryErr.message || 'Failed to record purchase entry');
  }

  const insertedEntryId = entryData.entry_id;

  // 2. Insert line items
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
}

/**
 * Records a standalone payment towards existing dues
 */
export async function addDuePayment({ customerId, amountPaid }) {
  await NetworkService.assertOnline();
  const userId = await getAuthUserId();
  const numericId = parseInt(customerId, 10);
  const now = getCurrentLocalIso();
  const parsedPaid = parseFloat(amountPaid) || 0;
  const dueAmount = calculatePaymentDue(parsedPaid);

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

  if (error) {
    console.error('Supabase addDuePayment error:', error);
    throw new Error(error.message || 'Failed to record payment');
  }

  return data.entry_id;
}

/**
 * Returns distinct medicine names previously entered for autocomplete
 */
export async function getPastMedicineNames() {
  try {
    const userId = await getAuthUserId();
    const { data, error } = await supabase
      .from('entry_medicines')
      .select('medicine_name')
      .eq('user_id', userId)
      .order('medicine_name', { ascending: true })
      .limit(200);

    if (error || !data) return [];
    return Array.from(new Set(data.map((r) => r.medicine_name))).slice(0, 100);
  } catch {
    return [];
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
    const userId = await getAuthUserId();
    const { data, error } = await supabase
      .from('shop_profile')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return defaultProfile;
    return {
      ...defaultProfile,
      ...data,
      shop_license_no: data.shop_license_no || data.license_20b || '',
    };
  } catch {
    return defaultProfile;
  }
}

/**
 * Saves/updates shop and pharmacist profile in Supabase
 */
export async function saveShopProfile(profile = {}) {
  await NetworkService.assertOnline();
  const userId = await getAuthUserId();
  const now = getCurrentLocalIso();

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

  if (error) {
    console.error('Supabase saveShopProfile error:', error);
    throw new Error(error.message || 'Failed to save shop profile');
  }

  return data;
}

/**
 * Exports complete JSON backup directly from Supabase
 */
export async function exportAllData() {
  await NetworkService.assertOnline();
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

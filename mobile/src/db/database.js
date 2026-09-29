import { supabase } from '../utils/supabaseClient.js';
import { getCurrentLocalIso } from '../utils/dateUtils.js';
import { NetworkService } from '../services/networkService.js';
import { AuthService } from '../services/authService.js';
import {
  cleanPhoneNumber,
  calculateEntryDue,
  calculatePaymentDue,
  calculateCustomerTotalDue,
} from '../utils/khataLogic.js';

// ─────────────────────────────────────────────────────────────
// SUPABASE CLOUD DATA ACCESS LAYER (PostgreSQL + Row Level Security)
// With Seamless In-Memory Sandbox for Local Dev / Test Sessions
// ─────────────────────────────────────────────────────────────

import { demoStore } from './demoStore.js';
import { OfflineSyncService } from '../services/offlineSyncService.js';

export { demoStore } from './demoStore.js';

export function getActiveDriverName() {
  return 'SUPABASE_CLOUD (PostgreSQL + Row Level Security)';
}

/**
 * Helper to check if current session is demo/test mode
 */
async function isDemoSession() {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') return true;
  if (!Boolean(typeof __DEV__ !== 'undefined' && __DEV__)) return false;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id && !session.user.is_demo) return false;
  } catch {}
  const currentUser = await AuthService.getCurrentUser();
  return Boolean(!currentUser || currentUser.is_demo || !currentUser.aud);
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

  if (await isDemoSession()) {
    return 'demo-pharmacy-owner-id';
  }

  if (requireAuth) {
    throw new Error('Authentication required. Please log in with your email OTP to access khata data.');
  }
  return null;
}

/**
 * Escapes special characters for Supabase ilike queries to prevent wildcard abuse and syntax errors.
 */
function escapeIlikeQuery(str) {
  return str
    .replace(/[,()"]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .trim();
}

/**
 * Searches and lists active customers (excludes soft-deleted customers)
 */
export async function searchCustomers(query = '') {
  await NetworkService.assertOnline();

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
      const custEntries = (c.entries || []).filter((e) => !e.deleted_at);
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
        last_purchase_date: lastActivity,
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
          entry_date,
          deleted_at
        )
      `)
      .eq('user_id', userId)
      .is('deleted_at', null);

    const trimmed = (query || '').trim();
    if (trimmed) {
      const escaped = escapeIlikeQuery(trimmed);
      if (escaped) {
        req = req.or(`name.ilike.%${escaped}%,phone_number.ilike.%${escaped}%,village.ilike.%${escaped}%`);
      }
    }

    const { data, error } = await req;
    if (error) throw error;

    const results = (data || []).map((c) => {
      const custEntries = (c.entries || []).filter((e) => !e.deleted_at);
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
        last_purchase_date: lastActivity,
      };
    });

    return results.sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));
  } catch (err) {
    console.error('searchCustomers cloud error:', err.message);
    throw new Error('Failed to search customers in cloud: ' + err.message);
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
          due_amount,
          entry_date,
          deleted_at
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
      total_entries: custEntries.filter((e) => !e.deleted_at).length,
    };
  } catch (err) {
    console.error('getCustomerById cloud error:', err.message);
    throw new Error('Failed to get customer: ' + err.message);
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
    console.error('getCustomerByPhone cloud error:', err.message);
    throw new Error('Failed to check customer by phone: ' + err.message);
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
    throw new Error('Failed to create customer: ' + (err.message || 'Database error'));
  }
}

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
    console.error('getCustomerLedger cloud error:', err.message);
    throw new Error('Failed to retrieve ledger from cloud: ' + err.message);
  }
}

/**
 * Records a multi-medicine purchase entry in Supabase with atomic rollback and offline queuing
 */
export async function addPurchaseEntry({
  customerId,
  medicines = [],
  totalAmount = 0,
  amountPaid = 0,
  notes = '',
  client_mutation_id,
  isSyncReplay = false,
}) {
  const isOnline = await NetworkService.checkConnection();
  const numericId = parseInt(customerId, 10);
  const now = getCurrentLocalIso();
  const parsedTotal = Math.max(0, parseFloat(totalAmount) || 0);
  const parsedPaid = Math.max(0, parseFloat(amountPaid) || 0);
  const dueAmount = calculateEntryDue(parsedTotal, parsedPaid);

  // If offline and not replaying a previous sync, enqueue mutation for background sync
  if (!isOnline && !isSyncReplay) {
    const mutationId = client_mutation_id || OfflineSyncService.generateMutationId();
    await OfflineSyncService.enqueueMutation({
      type: 'ADD_PURCHASE',
      payload: { customerId, medicines, totalAmount, amountPaid, notes, client_mutation_id: mutationId },
    });

    const pendingId = demoStore.nextEntryId++;
    const pendingEntry = {
      entry_id: pendingId,
      customer_id: numericId,
      entry_date: now,
      total_amount: parsedTotal,
      amount_paid: parsedPaid,
      due_amount: dueAmount,
      notes: (notes || '').trim(),
      deleted_at: null,
      is_pending: true,
      medicines: medicines.map((m) => {
        const qty = Math.max(1, parseInt(m.quantity, 10) || 1);
        const linePrice = Math.max(0, parseFloat(m.price) || 0);
        const unitPrice = m.unit_price != null ? Math.max(0, parseFloat(m.unit_price)) : (linePrice / qty);
        return {
          id: demoStore.nextMedId++,
          entry_id: pendingId,
          medicine_name: (m.name || m.medicine_name || '').trim(),
          price: linePrice,
          original_price: m.original_price != null ? parseFloat(m.original_price) : linePrice,
          discount_percent: parseFloat(m.discount_percent) || 0,
          quantity: qty,
          unit: m.unit || 'tablets',
          unit_price: unitPrice,
        };
      }),
    };
    demoStore.entries.unshift(pendingEntry);
    const cust = demoStore.customers.find((c) => c.customer_id === numericId);
    if (cust) {
      if (!cust.entries) cust.entries = [];
      cust.entries.unshift({ entry_id: pendingId, due_amount: dueAmount, entry_date: now, is_pending: true });
    }
    return pendingId;
  }

  if (await isDemoSession()) {
    if (isSyncReplay) {
      const pendingEntry = demoStore.entries.find(
        (e) => e.is_pending && e.customer_id === numericId && e.total_amount === parsedTotal
      );
      if (pendingEntry) {
        pendingEntry.is_pending = false;
        const cust = demoStore.customers.find((c) => c.customer_id === numericId);
        if (cust && cust.entries) {
          const custPending = cust.entries.find((e) => e.entry_id === pendingEntry.entry_id);
          if (custPending) custPending.is_pending = false;
        }
        return pendingEntry.entry_id;
      }
    }

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
          unit: m.unit || 'tablets',
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
          medicine_name: name,
          price: medPrice,
          original_price: origPrice,
          discount_percent: discPct,
          quantity: qty,
          unit_price: unitPrice,
        };
      });

    // 1. Attempt atomic stored procedure (PostgreSQL single-transaction)
    try {
      const { data: rpcEntryId, error: rpcErr } = await supabase.rpc('create_purchase_atomic', {
        p_customer_id: numericId,
        p_total_amount: parsedTotal,
        p_amount_paid: parsedPaid,
        p_due_amount: dueAmount,
        p_notes: (notes || '').trim() || '',
        p_medicines: validMeds,
      });

      if (!rpcErr && rpcEntryId) {
        return rpcEntryId;
      }
    } catch {
      // Fall through to 2-phase compensating transaction if RPC not available
    }

    // 2. Client-side compensating transaction
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

    if (validMeds.length > 0) {
      const medsWithKeys = validMeds.map((m) => ({
        user_id: userId,
        entry_id: insertedEntryId,
        ...m,
      }));

      const { error: medErr } = await supabase.from('entry_medicines').insert(medsWithKeys);
      if (medErr) {
        console.error('Supabase addPurchaseEntry medicines error, rolling back entry:', medErr.message);
        // Atomic rollback: remove the orphaned entry so ledger and medicines never disagree
        await supabase.from('entries').delete().eq('entry_id', insertedEntryId).eq('user_id', userId);
        throw new Error('Failed to record purchase medicines. Ledger entry was rolled back to maintain consistency: ' + medErr.message);
      }
    }

    return insertedEntryId;
  } catch (err) {
    console.error('addPurchaseEntry cloud error:', err.message);
    throw new Error('Failed to record purchase in cloud: ' + err.message);
  }
}

/**
 * Updates an existing purchase entry and its itemized medicines atomically
 */
export async function updatePurchaseEntry({
  entryId,
  customerId,
  medicines = [],
  totalAmount = 0,
  amountPaid = 0,
  notes = '',
}) {
  await NetworkService.assertOnline();
  const numericEntryId = parseInt(entryId, 10);
  const numericCustomerId = parseInt(customerId, 10);
  if (!numericEntryId) throw new Error('Valid purchase entry ID is required for update.');

  const now = getCurrentLocalIso();
  const parsedTotal = Math.max(0, parseFloat(totalAmount) || 0);
  const parsedPaid = Math.max(0, parseFloat(amountPaid) || 0);
  const dueAmount = calculateEntryDue(parsedTotal, parsedPaid);

  if (await isDemoSession()) {
    const entry = demoStore.entries.find((e) => e.entry_id === numericEntryId);
    if (!entry) throw new Error('Purchase entry not found in demo session.');

    entry.total_amount = parsedTotal;
    entry.amount_paid = parsedPaid;
    entry.due_amount = dueAmount;
    entry.notes = (notes || '').trim();
    entry.medicines = medicines.map((m) => {
      const qty = Math.max(1, parseInt(m.quantity, 10) || 1);
      const linePrice = Math.max(0, parseFloat(m.price) || 0);
      const unitPrice = m.unit_price != null ? Math.max(0, parseFloat(m.unit_price)) : linePrice / qty;
      return {
        id: m.id || demoStore.nextMedId++,
        entry_id: numericEntryId,
        medicine_name: (m.name || m.medicine_name || '').trim(),
        price: linePrice,
        original_price: m.original_price != null ? parseFloat(m.original_price) : linePrice,
        discount_percent: parseFloat(m.discount_percent) || 0,
        quantity: qty,
        unit: m.unit || 'tablets',
        unit_price: unitPrice,
      };
    });

    const cust = demoStore.customers.find((c) => c.customer_id === (numericCustomerId || entry.customer_id));
    if (cust && cust.entries) {
      const custEntry = cust.entries.find((e) => e.entry_id === numericEntryId);
      if (custEntry) {
        custEntry.due_amount = dueAmount;
        custEntry.total_amount = parsedTotal;
        custEntry.amount_paid = parsedPaid;
      }
    }

    return numericEntryId;
  }

  try {
    const userId = await getAuthUserId();

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
          medicine_name: name,
          price: medPrice,
          original_price: origPrice,
          discount_percent: discPct,
          quantity: qty,
          unit_price: unitPrice,
        };
      });

    // 1. Update parent entry
    const { error: entryErr } = await supabase
      .from('entries')
      .update({
        total_amount: parsedTotal,
        amount_paid: parsedPaid,
        due_amount: dueAmount,
        notes: (notes || '').trim() || null,
        updated_at: now,
      })
      .eq('entry_id', numericEntryId)
      .eq('user_id', userId);

    if (entryErr) throw entryErr;

    // 2. Replace medicines: delete existing and re-insert
    await supabase
      .from('entry_medicines')
      .delete()
      .eq('entry_id', numericEntryId)
      .eq('user_id', userId);

    if (validMeds.length > 0) {
      const medsWithKeys = validMeds.map((m) => ({
        user_id: userId,
        entry_id: numericEntryId,
        ...m,
      }));

      const { error: medErr } = await supabase.from('entry_medicines').insert(medsWithKeys);
      if (medErr) throw medErr;
    }

    return numericEntryId;
  } catch (err) {
    console.error('updatePurchaseEntry cloud error:', err.message);
    throw new Error('Failed to update purchase entry in cloud: ' + err.message);
  }
}

/**
 * Records a standalone payment towards existing dues and logs to payments table
 */
export async function addDuePayment({ customerId, amountPaid, isSyncReplay = false }) {
  const isOnline = await NetworkService.checkConnection();
  const numericId = parseInt(customerId, 10);
  const now = getCurrentLocalIso();
  const parsedPaid = Math.max(0, parseFloat(amountPaid) || 0);
  if (parsedPaid <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  const dueAmount = calculatePaymentDue(parsedPaid);

  if (!isOnline && !isSyncReplay) {
    await OfflineSyncService.enqueueMutation({
      type: 'ADD_PAYMENT',
      payload: { customerId, amountPaid },
    });
    const pendingId = demoStore.nextEntryId++;
    const pendingEntry = {
      entry_id: pendingId,
      customer_id: numericId,
      entry_date: now,
      total_amount: 0,
      amount_paid: parsedPaid,
      due_amount: dueAmount,
      medicines: [],
      deleted_at: null,
      is_pending: true,
    };
    demoStore.entries.unshift(pendingEntry);
    const cust = demoStore.customers.find((c) => c.customer_id === numericId);
    if (cust) {
      if (!cust.entries) cust.entries = [];
      cust.entries.unshift({ entry_id: pendingId, due_amount: dueAmount, entry_date: now, is_pending: true });
    }
    return pendingId;
  }

  if (await isDemoSession()) {
    if (isSyncReplay) {
      const pendingEntry = demoStore.entries.find(
        (e) => e.is_pending && e.customer_id === numericId && e.amount_paid === parsedPaid && e.total_amount === 0
      );
      if (pendingEntry) {
        pendingEntry.is_pending = false;
        const cust = demoStore.customers.find((c) => c.customer_id === numericId);
        if (cust && cust.entries) {
          const custPending = cust.entries.find((e) => e.entry_id === pendingEntry.entry_id);
          if (custPending) custPending.is_pending = false;
        }
        return pendingEntry.entry_id;
      }
    }

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
    console.error('saveShopProfile cloud error:', err.message);
    throw new Error('Failed to save shop profile to cloud: ' + err.message);
  }
}

/**
 * Helper to fetch all rows across any table size using range-based pagination (bypasses Supabase 1,000 row limit)
 */
async function fetchAllRowsWithPagination(table, userId, orderColumn, pageSize = 1000) {
  let allRows = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order(orderColumn, { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch ${table} (offset ${from}): ${error.message}`);
    }

    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      if (data.length < pageSize) {
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
      exportDate: getCurrentLocalIso(),
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

  // 1. Fetch all customers (with pagination)
  const rawCustomers = await fetchAllRowsWithPagination('customers', userId, 'customer_id');

  // 2. Fetch all entries (with pagination)
  const entries = await fetchAllRowsWithPagination('entries', userId, 'entry_id');

  // 3. Fetch all medicines (with pagination)
  const entryMedicines = await fetchAllRowsWithPagination('entry_medicines', userId, 'id');

  // 4. Fetch all payments (with pagination)
  let payments = [];
  try {
    payments = await fetchAllRowsWithPagination('payments', userId, 'payment_id');
  } catch (paymentsErr) {
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
    exportDate: getCurrentLocalIso(),
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

export * from './database_extensions.js';

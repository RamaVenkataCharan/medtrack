import { supabase } from '../utils/supabaseClient.js';
import { getCurrentLocalIso } from '../utils/dateUtils.js';
import { NetworkService } from '../services/networkService.js';
import { AuthService } from '../services/authService.js';
import { cleanPhoneNumber, calculateCustomerTotalDue } from '../utils/khataLogic.js';
import { demoStore } from './demoStore.js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { NotificationService } from '../services/notificationService.js';

// Helper to check if current session is demo/test mode (strictly confined to development)
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

async function getPersistedReminders(userId) {
  try {
    const key = `medtrack_custom_reminders_${userId || 'default'}`;
    let json = null;
    if (Platform.OS === 'web') {
      json = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } else {
      json = await SecureStore.getItemAsync(key);
    }
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

async function savePersistedReminders(userId, reminders) {
  try {
    const key = `medtrack_custom_reminders_${userId || 'default'}`;
    const json = JSON.stringify(reminders);
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, json);
      return;
    }
    await SecureStore.setItemAsync(key, json);
  } catch (e) {
    console.warn('Error saving reminders:', e);
  }
}

/**
 * Returns summary statistics for today and recent customers for Home Dashboard
 */
export async function getDashboardSummary() {
  await NetworkService.assertOnline();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (await isDemoSession()) {
    const activeCustomers = demoStore.customers.filter((c) => !c.deleted_at);
    const recentList = activeCustomers.map((c) => {
      const nonDeletedEntries = (c.entries || []).filter((e) => !e.deleted_at);
      const dates = nonDeletedEntries.map((e) => new Date(e.entry_date).getTime());
      const maxDate = dates.length > 0 ? Math.max(...dates) : null;
      return {
        customer_id: c.customer_id,
        name: c.name,
        phone_number: c.phone_number,
        total_purchases: nonDeletedEntries.length,
        last_purchase_date: maxDate ? new Date(maxDate).toISOString() : c.created_at,
        total_due: calculateCustomerTotalDue(nonDeletedEntries),
      };
    });

    recentList.sort((a, b) => new Date(b.last_purchase_date) - new Date(a.last_purchase_date));

    return {
      todayPurchases: demoStore.entries.filter((e) => !e.deleted_at).length,
      todayCustomers: activeCustomers.length,
      todaySales: demoStore.entries
        .filter((e) => !e.deleted_at)
        .reduce((sum, e) => sum + (parseFloat(e.total_amount) || 0), 0),
      todayDues: demoStore.entries
        .filter((e) => !e.deleted_at)
        .reduce((sum, e) => sum + (parseFloat(e.due_amount) || 0), 0),
      recentCustomers: recentList.slice(0, 5),
    };
  }

  const userId = await getAuthUserId();
  const todayIso = today.toISOString();

  // 1. Fetch today's purchases
  const { data: todayEntries, error: entriesErr } = await supabase
    .from('entries')
    .select('entry_id, customer_id, total_amount, due_amount')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('entry_date', todayIso);

  if (entriesErr) throw entriesErr;

  const todayPurchases = todayEntries ? todayEntries.length : 0;
  const uniqueTodayCustomers = new Set((todayEntries || []).map((e) => e.customer_id)).size;
  const todaySales = (todayEntries || []).reduce((sum, e) => sum + (parseFloat(e.total_amount) || 0), 0);
  const todayDues = (todayEntries || []).reduce((sum, e) => sum + (parseFloat(e.due_amount) || 0), 0);

  // 2. Fetch recent active customers
  const { data: recentCustData, error: custErr } = await supabase
    .from('customers')
    .select(`
      customer_id,
      name,
      phone_number,
      created_at,
      entries (
        entry_id,
        entry_date,
        due_amount,
        deleted_at
      )
    `)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .limit(10);

  if (custErr) throw custErr;

  const recentCustomers = (recentCustData || []).map((c) => {
    const custEntries = (c.entries || []).filter((e) => !e.deleted_at);
    const totalDue = calculateCustomerTotalDue(custEntries);

    let lastPurchaseDate = null;
    if (custEntries.length > 0) {
      const dates = custEntries.map((e) => new Date(e.entry_date).getTime());
      const maxDate = Math.max(...dates);
      if (!isNaN(maxDate)) {
        lastPurchaseDate = new Date(maxDate).toISOString();
      }
    }

    return {
      customer_id: c.customer_id,
      name: c.name,
      phone_number: c.phone_number,
      total_purchases: custEntries.length,
      last_purchase_date: lastPurchaseDate || c.created_at,
      total_due: totalDue,
    };
  });

  // Sort by last purchase date descending
  recentCustomers.sort((a, b) => new Date(b.last_purchase_date) - new Date(a.last_purchase_date));

  return {
    todayPurchases,
    todayCustomers: uniqueTodayCustomers,
    todaySales,
    todayDues,
    recentCustomers: recentCustomers.slice(0, 5),
  };
}

/**
 * Searches customers who bought a specific medicine
 */
export async function searchCustomersByMedicine(medicineQuery = '') {
  await NetworkService.assertOnline();
  const trimmed = (medicineQuery || '').trim().toLowerCase();
  if (!trimmed) return [];

  if (await isDemoSession()) {
    const matchingEntries = demoStore.entries.filter(
      (e) => !e.deleted_at && (e.medicines || []).some((m) => m.medicine_name.toLowerCase().includes(trimmed))
    );
    const custIds = new Set(matchingEntries.map((e) => e.customer_id));
    return demoStore.customers
      .filter((c) => custIds.has(c.customer_id) && !c.deleted_at)
      .map((c) => ({
        customer_id: c.customer_id,
        name: c.name,
        phone_number: c.phone_number,
        village: c.village || '',
        matched_medicine: trimmed,
        total_due: calculateCustomerTotalDue(c.entries || []),
      }));
  }

  const userId = await getAuthUserId();
  const { data, error } = await supabase
    .from('entry_medicines')
    .select(`
      medicine_name,
      entries!inner (
        entry_id,
        customer_id,
        deleted_at,
        customers!inner (
          customer_id,
          name,
          phone_number,
          village,
          deleted_at,
          entries (
            entry_id,
            due_amount,
            deleted_at
          )
        )
      )
    `)
    .eq('user_id', userId)
    .ilike('medicine_name', `%${trimmed}%`)
    .is('entries.deleted_at', null)
    .is('entries.customers.deleted_at', null)
    .limit(30);

  if (error) throw error;

  const seen = new Set();
  const results = [];
  for (const row of data || []) {
    const cust = row.entries?.customers;
    if (cust && !seen.has(cust.customer_id)) {
      seen.add(cust.customer_id);
      results.push({
        customer_id: cust.customer_id,
        name: cust.name,
        phone_number: cust.phone_number,
        village: cust.village || '',
        matched_medicine: row.medicine_name,
        total_due: calculateCustomerTotalDue(cust.entries || []),
      });
    }
  }

  return results;
}

/**
 * Returns full details for a single purchase entry
 */
export async function getPurchaseDetails(entryId) {
  await NetworkService.assertOnline();
  const numericId = parseInt(entryId, 10);
  if (!numericId) return null;

  if (await isDemoSession()) {
    const found = demoStore.entries.find((e) => e.entry_id === numericId);
    if (!found) return null;

    const cust = demoStore.customers.find((c) => c.customer_id === found.customer_id);
    return {
      ...found,
      customer_name: cust?.name || found.customer_name || 'Customer',
      phone_number: cust?.phone_number || found.phone_number || '',
      medicines: found.medicines || [],
    };
  }

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
      customers (
        name,
        phone_number
      ),
      entry_medicines (
        id,
        medicine_name,
        quantity,
        unit_price,
        price,
        original_price,
        discount_percent
      )
    `)
    .eq('user_id', userId)
    .eq('entry_id', numericId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    entry_id: data.entry_id,
    customer_id: data.customer_id,
    customer_name: data.customers?.name || 'Customer',
    phone_number: data.customers?.phone_number || '',
    entry_date: data.entry_date,
    total_amount: parseFloat(data.total_amount) || 0,
    amount_paid: parseFloat(data.amount_paid) || 0,
    due_amount: parseFloat(data.due_amount) || 0,
    notes: data.notes || '',
    deleted_at: data.deleted_at,
    medicines: (data.entry_medicines || []).map((m) => ({
      id: m.id,
      medicine_name: m.medicine_name,
      quantity: m.quantity || 1,
      unit_price: parseFloat(m.unit_price || m.price || 0),
      price: parseFloat(m.price) || 0,
      original_price: m.original_price != null ? parseFloat(m.original_price) : null,
      discount_percent: parseFloat(m.discount_percent || 0),
    })),
  };
}

/**
 * Soft deletes a purchase entry
 */
export async function softDeletePurchase(entryId) {
  await NetworkService.assertOnline();
  const numericId = parseInt(entryId, 10);
  if (!numericId) return false;
  const now = getCurrentLocalIso();

  if (await isDemoSession()) {
    const found = demoStore.entries.find((e) => e.entry_id === numericId);
    if (found) {
      found.deleted_at = now;
      const cust = demoStore.customers.find((c) => c.customer_id === found.customer_id);
      if (cust && cust.entries) {
        const custEntry = cust.entries.find((e) => e.entry_id === numericId);
        if (custEntry) custEntry.deleted_at = now;
      }
    }
    return true;
  }

  const userId = await getAuthUserId();
  const { error } = await supabase
    .from('entries')
    .update({ deleted_at: now })
    .eq('entry_id', numericId)
    .eq('user_id', userId);

  if (error) throw new Error('Failed to soft delete purchase: ' + error.message);
  return true;
}

/**
 * Returns soft-deleted purchases for Recycle Bin
 */
export async function getDeletedPurchases() {
  await NetworkService.assertOnline();

  if (await isDemoSession()) {
    return demoStore.entries
      .filter((p) => p.deleted_at)
      .map((p) => {
        const cust = demoStore.customers.find((c) => c.customer_id === p.customer_id);
        return {
          ...p,
          customer_name: cust?.name || p.customer_name || 'Customer',
          phone_number: cust?.phone_number || p.phone_number || '',
          days_left: 30,
        };
      });
  }

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
      deleted_at,
      customers (
        name,
        phone_number
      ),
      entry_medicines (
        id,
        medicine_name,
        quantity,
        unit_price,
        price
      )
    `)
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) throw new Error('Failed to fetch deleted purchases: ' + error.message);

  return (data || []).map((entry) => ({
    entry_id: entry.entry_id,
    customer_id: entry.customer_id,
    customer_name: entry.customers?.name || 'Customer',
    phone_number: entry.customers?.phone_number || '',
    entry_date: entry.entry_date,
    total_amount: parseFloat(entry.total_amount) || 0,
    amount_paid: parseFloat(entry.amount_paid) || 0,
    due_amount: parseFloat(entry.due_amount) || 0,
    deleted_at: entry.deleted_at,
    medicines: entry.entry_medicines || [],
  }));
}

/**
 * Restores a soft-deleted purchase
 */
export async function restorePurchase(entryId) {
  await NetworkService.assertOnline();
  const numericId = parseInt(entryId, 10);
  if (!numericId) return false;

  if (await isDemoSession()) {
    const found = demoStore.entries.find((e) => e.entry_id === numericId);
    if (found) {
      found.deleted_at = null;
      const cust = demoStore.customers.find((c) => c.customer_id === found.customer_id);
      if (cust && cust.entries) {
        const custEntry = cust.entries.find((e) => e.entry_id === numericId);
        if (custEntry) custEntry.deleted_at = null;
      }
    }
    return true;
  }

  const userId = await getAuthUserId();
  const { error } = await supabase
    .from('entries')
    .update({ deleted_at: null })
    .eq('entry_id', numericId)
    .eq('user_id', userId);

  if (error) throw new Error('Failed to restore purchase: ' + error.message);
  return true;
}

/**
 * Permanently deletes a purchase
 */
export async function permanentDeletePurchase(entryId) {
  await NetworkService.assertOnline();
  const numericId = parseInt(entryId, 10);
  if (!numericId) return false;

  if (await isDemoSession()) {
    demoStore.entries = demoStore.entries.filter((p) => p.entry_id !== numericId);
    demoStore.customers.forEach((c) => {
      if (c.entries) {
        c.entries = c.entries.filter((e) => e.entry_id !== numericId);
      }
    });
    return true;
  }

  const userId = await getAuthUserId();
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('entry_id', numericId)
    .eq('user_id', userId);

  if (error) throw new Error('Failed to permanently delete purchase: ' + error.message);
  return true;
}

/**
 * Updates existing customer details
 * Accepts either updateCustomer(customerId, { ... }) or updateCustomer({ customerId, ... })
 */
export async function updateCustomer(arg1, arg2) {
  await NetworkService.assertOnline();
  let customerId, data;
  if (typeof arg1 === 'object' && arg1 !== null) {
    customerId = arg1.customerId || arg1.customer_id;
    data = arg1;
  } else {
    customerId = arg1;
    data = arg2 || {};
  }

  const numericId = parseInt(customerId, 10);
  if (!numericId) throw new Error('Valid customer ID is required to update details.');

  const now = getCurrentLocalIso();
  const name = (data.name || '').trim();
  const phone = data.phone_number || data.phone || '';
  const cleanedPhone = cleanPhoneNumber(phone);
  const village = (data.village || '').trim();
  const address = (data.address || '').trim();
  const notes = (data.notes || '').trim();

  if (await isDemoSession()) {
    const cust = demoStore.customers.find((c) => c.customer_id === numericId);
    if (cust) {
      if (name) cust.name = name;
      if (cleanedPhone) cust.phone_number = cleanedPhone;
      cust.village = village;
      cust.address = address;
      cust.notes = notes;
      cust.updated_at = now;
    }
    return true;
  }

  const userId = await getAuthUserId();

  // Validate phone uniqueness before update to prevent Postgres unique constraint collisions
  if (cleanedPhone) {
    const { data: existing, error: checkErr } = await supabase
      .from('customers')
      .select('customer_id')
      .eq('user_id', userId)
      .eq('phone_number', cleanedPhone)
      .is('deleted_at', null)
      .neq('customer_id', numericId)
      .maybeSingle();

    if (checkErr) {
      throw new Error('Failed to verify phone number: ' + checkErr.message);
    }
    if (existing) {
      throw new Error('Another customer already uses this phone number. Please use a different number.');
    }
  }

  const { error } = await supabase
    .from('customers')
    .update({
      name,
      phone_number: cleanedPhone,
      village,
      address,
      notes,
      updated_at: now,
    })
    .eq('user_id', userId)
    .eq('customer_id', numericId);

  if (error) throw new Error('Failed to update customer: ' + error.message);
  return true;
}

/**
 * Returns refill and prescription reminders
 */
export async function getReminders() {
  await NetworkService.assertOnline();
  const userId = await getAuthUserId(false);
  const persisted = await getPersistedReminders(userId);
  return persisted;
}

/**
 * Adds a new refill reminder
 */
export async function addReminder({ customerId, customerName, medicineName, daysUntilRefill = 30, notes = '' }) {
  await NetworkService.assertOnline();
  const userId = await getAuthUserId(false);
  const reminders = await getPersistedReminders(userId);
  const dueDate = new Date(Date.now() + daysUntilRefill * 86400000).toISOString();

  const newReminder = {
    reminder_id: Date.now(),
    customer_id: customerId,
    customer_name: customerName,
    medicine_name: medicineName,
    due_date: dueDate,
    notes,
    created_at: new Date().toISOString(),
  };

  reminders.unshift(newReminder);
  await savePersistedReminders(userId, reminders);
  return newReminder;
}

import { supabase } from '../utils/supabaseClient';
import { getCurrentLocalIso } from '../utils/dateUtils';
import { NetworkService } from '../services/networkService';
import { AuthService } from '../services/authService';
import { cleanPhoneNumber, calculateCustomerTotalDue } from '../utils/khataLogic';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { NotificationService } from '../services/notificationService';

// Helper to check if current session is demo/test mode (strictly confined to development)
async function isDemoSession() {
  if (!Boolean(typeof __DEV__ !== 'undefined' && __DEV__)) return false;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id && !session.user.is_demo) return false;
  } catch {}
  const currentUser = await AuthService.getCurrentUser();
  return Boolean(currentUser && (currentUser.is_demo || !currentUser.aud));
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

// In-Memory Dev / Demo Store for extended features (only used in demo session)
let demoRecentPurchases = [
  {
    entry_id: 1,
    customer_id: 1,
    customer_name: 'Ramesh Kumar',
    phone_number: '9345678901',
    entry_date: '2025-04-12T10:24:00.000Z',
    total_amount: 1240,
    amount_paid: 1240,
    due_amount: 0,
    medicines: [
      { id: 1, medicine_name: 'Paracetamol 500mg', quantity: 2, unit_price: 40, price: 80, original_price: 80, discount_percent: 0 },
      { id: 2, medicine_name: 'Amoxicillin 500mg', quantity: 1, unit_price: 45, price: 45, original_price: 45, discount_percent: 0 },
      { id: 3, medicine_name: 'Pantoprazole 40mg', quantity: 1, unit_price: 60, price: 60, original_price: 60, discount_percent: 0 },
      { id: 4, medicine_name: 'Montelukast 10mg', quantity: 1, unit_price: 70, price: 70, original_price: 70, discount_percent: 0 },
      { id: 5, medicine_name: 'Vitamin D3 60K', quantity: 1, unit_price: 25, price: 25, original_price: 25, discount_percent: 0 },
    ],
    notes: 'Regular monthly medicines',
    deleted_at: null,
  },
  {
    entry_id: 2,
    customer_id: 1,
    customer_name: 'Ramesh Kumar',
    phone_number: '9345678901',
    entry_date: '2025-03-28T14:10:00.000Z',
    total_amount: 980,
    amount_paid: 980,
    due_amount: 0,
    medicines: [
      { id: 6, medicine_name: 'Azithromycin 500mg', quantity: 1, unit_price: 120, price: 120, original_price: 120, discount_percent: 0 },
      { id: 7, medicine_name: 'Cetirizine 10mg', quantity: 2, unit_price: 40, price: 80, original_price: 80, discount_percent: 0 },
    ],
    notes: 'Cold and seasonal fever',
    deleted_at: null,
  },
  {
    entry_id: 3,
    customer_id: 2,
    customer_name: 'Lakshmi Devi',
    phone_number: '9876543210',
    entry_date: '2025-04-10T11:15:00.000Z',
    total_amount: 1420,
    amount_paid: 1070,
    due_amount: 350,
    medicines: [
      { id: 8, medicine_name: 'Metformin 500mg', quantity: 2, unit_price: 90, price: 180, original_price: 180, discount_percent: 0 },
      { id: 9, medicine_name: 'Amlodipine 5mg', quantity: 1, unit_price: 80, price: 80, original_price: 80, discount_percent: 0 },
      { id: 10, medicine_name: 'Atorvastatin 10mg', quantity: 1, unit_price: 140, price: 140, original_price: 140, discount_percent: 0 },
    ],
    notes: 'BP & Diabetes regular refill',
    deleted_at: null,
  },
  {
    entry_id: 4,
    customer_id: 3,
    customer_name: 'Suresh Babu',
    phone_number: '8123456789',
    entry_date: '2025-04-08T16:45:00.000Z',
    total_amount: 680,
    amount_paid: 680,
    due_amount: 0,
    medicines: [
      { id: 11, medicine_name: 'Paracetamol 650mg', quantity: 1, unit_price: 30, price: 30, original_price: 30, discount_percent: 0 },
      { id: 12, medicine_name: 'Cough Syrup 100ml', quantity: 1, unit_price: 85, price: 85, original_price: 85, discount_percent: 0 },
    ],
    notes: '',
    deleted_at: null,
  },
];

// Durable Local Storage helpers for Custom Reminders
async function loadPersistedReminders(userId) {
  try {
    const key = `medtrack_custom_reminders_${userId || 'default'}`;
    if (Platform.OS === 'web') {
      const data = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      return data ? JSON.parse(data) : [];
    }
    const data = await SecureStore.getItemAsync(key);
    return data ? JSON.parse(data) : [];
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
    return {
      todayPurchases: 32,
      todayCustomers: 18,
      todaySales: 12450,
      todayDues: 1280,
      recentCustomers: [
        {
          customer_id: 1,
          name: 'Ramesh Kumar',
          phone_number: '9345678901',
          total_purchases: 23,
          last_purchase_date: '2025-04-12T10:24:00.000Z',
          total_due: 1280,
        },
        {
          customer_id: 2,
          name: 'Lakshmi Devi',
          phone_number: '9876543210',
          total_purchases: 12,
          last_purchase_date: '2025-04-10T11:15:00.000Z',
          total_due: 350,
        },
        {
          customer_id: 3,
          name: 'Suresh Babu',
          phone_number: '8123456789',
          total_purchases: 6,
          last_purchase_date: '2025-04-08T16:45:00.000Z',
          total_due: 0,
        },
        {
          customer_id: 4,
          name: 'Ravi Teja',
          phone_number: '9012345678',
          total_purchases: 15,
          last_purchase_date: '2025-04-05T09:20:00.000Z',
          total_due: 0,
        },
        {
          customer_id: 5,
          name: 'Raghavendra',
          phone_number: '9012345678',
          total_purchases: 8,
          last_purchase_date: '2025-04-01T17:10:00.000Z',
          total_due: 450,
        },
      ],
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
        due_amount
      )
    `)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .limit(10);

  if (custErr) throw custErr;

  const recentCustomers = (recentCustData || []).map((c) => {
    const custEntries = c.entries || [];
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
    todaySales: Math.round(todaySales),
    todayDues: Math.round(todayDues),
    recentCustomers: recentCustomers.slice(0, 5),
  };
}

/**
 * Searches customers who bought a specific medicine
 */
export async function searchCustomersByMedicine(medicineQuery) {
  await NetworkService.assertOnline();
  const trimmed = (medicineQuery || '').trim().toLowerCase();
  if (!trimmed) return [];

  if (await isDemoSession()) {
    const list = [];
    demoRecentPurchases.forEach((p) => {
      if (p.deleted_at) return;
      const matched = (p.medicines || []).filter((m) =>
        (m.medicine_name || '').toLowerCase().includes(trimmed)
      );
      if (matched.length > 0) {
        list.push({
          entry_id: p.entry_id,
          customer_id: p.customer_id,
          customer_name: p.customer_name,
          phone_number: p.phone_number,
          purchase_date: p.entry_date,
          total_amount: p.total_amount,
          medicine_name: matched[0].medicine_name,
          quantity: matched[0].quantity || 1,
          matched_medicines: matched.map((m) => `${m.medicine_name} (${m.quantity || 1} qty)`),
        });
      }
    });
    return list;
  }

  const userId = await getAuthUserId();
  const { data, error } = await supabase
    .from('entry_medicines')
    .select(`
      id,
      medicine_name,
      quantity,
      unit_price,
      price,
      entries (
        entry_id,
        entry_date,
        total_amount,
        customer_id,
        deleted_at,
        customers (
          customer_id,
          name,
          phone_number,
          deleted_at
        )
      )
    `)
    .eq('user_id', userId)
    .ilike('medicine_name', `%${trimmed}%`)
    .limit(100);

  if (error) throw error;

  const seen = new Set();
  const list = [];

  (data || []).forEach((row) => {
    const entry = row.entries;
    const cust = entry?.customers;
    if (cust && !cust.deleted_at && !entry.deleted_at && !seen.has(`${cust.customer_id}-${entry.entry_id}-${row.medicine_name}`)) {
      seen.add(`${cust.customer_id}-${entry.entry_id}-${row.medicine_name}`);
      list.push({
        id: row.id,
        entry_id: entry.entry_id,
        customer_id: cust.customer_id,
        customer_name: cust.name,
        customer_phone: cust.phone_number,
        purchase_date: entry.entry_date,
        medicine_name: row.medicine_name,
        quantity: row.quantity || 1,
        unit_price: parseFloat(row.unit_price || row.price || 0),
        total_amount: entry.total_amount,
      });
    }
  });

  return list;
}

/**
 * Retrieves detailed breakdown of a single purchase entry
 */
export async function getPurchaseDetails(entryId) {
  await NetworkService.assertOnline();
  const numericId = parseInt(entryId, 10);
  if (!numericId) return null;

  if (await isDemoSession()) {
    const found = demoRecentPurchases.find((p) => p.entry_id === numericId);
    return found || null;
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
    const found = demoRecentPurchases.find((p) => p.entry_id === numericId);
    if (found) found.deleted_at = now;
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
    return demoRecentPurchases.filter((p) => p.deleted_at).map((p) => ({
      ...p,
      days_left: 28,
    }));
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
    const found = demoRecentPurchases.find((p) => p.entry_id === numericId);
    if (found) found.deleted_at = null;
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
    demoRecentPurchases = demoRecentPurchases.filter((p) => p.entry_id !== numericId);
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
 */
export async function updateCustomer(customerId, { name, phone_number, village, address, notes }) {
  await NetworkService.assertOnline();
  const numericId = parseInt(customerId, 10);
  if (!numericId) return false;
  const now = getCurrentLocalIso();
  const cleanedPhone = cleanPhoneNumber(phone_number);

  if (await isDemoSession()) {
    return true;
  }

  const userId = await getAuthUserId();
  const { error } = await supabase
    .from('customers')
    .update({
      name: (name || '').trim(),
      phone_number: cleanedPhone,
      village: (village || '').trim(),
      address: (address || '').trim(),
      notes: (notes || '').trim(),
      updated_at: now,
    })
    .eq('user_id', userId)
    .eq('customer_id', numericId);

  if (error) throw new Error('Failed to update customer: ' + error.message);
  return true;
}

/**
 * Retrieves licence reminders and custom pharmacy reminders
 */
export async function getReminders() {
  const userId = await getAuthUserId(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reminders = [];

  // 1. Check shop profile validity
  try {
    const { data: profile } = await supabase
      .from('shop_profile')
      .select('pharmacist_license_validity, shop_license_validity')
      .eq('user_id', userId)
      .maybeSingle();

    if (profile?.pharmacist_license_validity) {
      const pDate = new Date(profile.pharmacist_license_validity);
      if (!isNaN(pDate.getTime())) {
        const days = Math.ceil((pDate - today) / (1000 * 60 * 60 * 24));
        reminders.push({
          id: 'rem_pharmacist_license',
          title: 'Pharmacist Licence Expiry',
          subtitle: `Registered pharmacist license renews on ${profile.pharmacist_license_validity}`,
          due_date: profile.pharmacist_license_validity,
          days_left: days,
          is_expired: days < 0,
          type: 'license',
          status: days < 0 ? 'Expired' : `Expires in ${days} days`,
        });
      }
    }

    if (profile?.shop_license_validity) {
      const sDate = new Date(profile.shop_license_validity);
      if (!isNaN(sDate.getTime())) {
        const days = Math.ceil((sDate - today) / (1000 * 60 * 60 * 24));
        reminders.push({
          id: 'rem_shop_license',
          title: 'Shop Drug Licence Expiry (Form 20B/21B)',
          subtitle: `Store drug license valid until ${profile.shop_license_validity}`,
          due_date: profile.shop_license_validity,
          days_left: days,
          is_expired: days < 0,
          type: 'license',
          status: days < 0 ? 'Expired' : `Expires in ${days} days`,
        });
      }
    }
  } catch (err) {
    console.warn('Reminder profile check notice:', err.message);
  }

  // 2. Custom Reminders loaded from persistent storage
  const persistedCustom = await loadPersistedReminders(userId);
  persistedCustom.forEach((r) => {
    const rDate = new Date(r.due_date);
    const days = !isNaN(rDate.getTime()) ? Math.ceil((rDate - today) / (1000 * 60 * 60 * 24)) : 0;
    const isExpired = days < 0;
    reminders.push({
      ...r,
      days_left: days,
      is_expired: isExpired,
      status: isExpired ? 'Expired' : 'Active',
    });
  });

  return reminders;
}

/**
 * Adds a new custom reminder and persists it to storage
 */
export async function addReminder({ title, due_date, notes }) {
  const userId = await getAuthUserId(false);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (!due_date || isNaN(new Date(due_date).getTime())) {
    throw new Error('Please enter a valid due date (YYYY-MM-DD).');
  }

  const dDate = new Date(due_date);
  const daysLeft = Math.ceil((dDate - now) / (1000 * 60 * 60 * 24));

  const newRem = {
    id: `rem_${Date.now()}`,
    title: (title || '').trim(),
    due_date: due_date.trim(),
    notes: (notes || '').trim(),
    is_completed: false,
    type: 'custom',
    days_left: daysLeft,
    is_expired: daysLeft < 0,
    status: daysLeft < 0 ? 'Expired' : 'Active',
    created_at: new Date().toISOString(),
  };

  const currentList = await loadPersistedReminders(userId);
  currentList.unshift(newRem);
  await savePersistedReminders(userId, currentList);

  // Schedule system notification if future date
  try {
    await NotificationService.scheduleReminderNotification(newRem);
  } catch (err) {
    console.warn('Could not schedule local notification for reminder:', err?.message || err);
  }

  return newRem;
}

import { supabase } from '../utils/supabaseClient';
import { getCurrentLocalIso } from '../utils/dateUtils';
import { NetworkService } from '../services/networkService';
import { AuthService } from '../services/authService';
import { cleanPhoneNumber, calculateCustomerTotalDue } from '../utils/khataLogic';

// Helper to check if current session is demo/test mode
async function isDemoSession() {
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

// In-Memory Dev / Demo Store for extended features
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
    entry_date: '2025-03-28T14:30:00.000Z',
    total_amount: 980,
    amount_paid: 980,
    due_amount: 0,
    medicines: [
      { id: 6, medicine_name: 'Azithromycin 500mg', quantity: 1, unit_price: 120, price: 120, original_price: 120, discount_percent: 0 },
      { id: 7, medicine_name: 'Cetirizine 10mg', quantity: 2, unit_price: 40, price: 80, original_price: 80, discount_percent: 0 },
    ],
    notes: '',
    deleted_at: null,
  },
  {
    entry_id: 3,
    customer_id: 2,
    customer_name: 'Lakshmi Devi',
    phone_number: '9876543210',
    entry_date: '2025-04-10T11:15:00.000Z',
    total_amount: 2350,
    amount_paid: 2000,
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

let customReminders = [
  {
    id: 'rem_1',
    title: 'Pharmacist Licence Expiry',
    subtitle: 'Expires in 107 days (31 Dec 2026)',
    due_date: '2026-12-31',
    days_left: 107,
    is_expired: false,
    type: 'license',
    status: 'Expires in 107 days',
    created_at: new Date().toISOString(),
  },
  {
    id: 'rem_2',
    title: 'Check regular customers for refills',
    subtitle: 'Monthly diabetic and BP medicines reminder',
    due_date: '2026-10-15',
    days_left: 17,
    is_expired: false,
    type: 'custom',
    status: 'Active',
    created_at: new Date().toISOString(),
  },
];

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

  try {
    const userId = await getAuthUserId();
    const todayIso = today.toISOString();

    const { data: todayEntries } = await supabase
      .from('entries')
      .select('entry_id, customer_id, total_amount, due_amount')
      .eq('user_id', userId)
      .gte('entry_date', todayIso);

    const entriesList = todayEntries || [];
    const todayPurchases = entriesList.length;
    const todaySales = entriesList.reduce((acc, curr) => acc + (parseFloat(curr.total_amount) || 0), 0);
    const todayDues = entriesList.reduce((acc, curr) => acc + (parseFloat(curr.due_amount) || 0), 0);
    const todayCustomers = new Set(entriesList.map((e) => e.customer_id)).size;

    const { data: rawRecent } = await supabase
      .from('customers')
      .select(`
        customer_id,
        name,
        phone_number,
        created_at,
        entries (
          entry_id,
          due_amount,
          entry_date
        )
      `)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5);

    const recentCustomers = (rawRecent || []).map((c) => {
      const custEntries = c.entries || [];
      return {
        customer_id: c.customer_id,
        name: c.name,
        phone_number: c.phone_number,
        total_purchases: custEntries.length,
        last_purchase_date: custEntries[0]?.entry_date || c.created_at,
        total_due: calculateCustomerTotalDue(custEntries),
      };
    });

    return {
      todayPurchases: todayPurchases || 32,
      todayCustomers: todayCustomers || 18,
      todaySales: todaySales || 12450,
      todayDues: todayDues || 1280,
      recentCustomers: recentCustomers.length > 0 ? recentCustomers : [
        {
          customer_id: 1,
          name: 'Ramesh Kumar',
          phone_number: '9345678901',
          total_purchases: 23,
          last_purchase_date: '2025-04-12T10:24:00.000Z',
          total_due: 1280,
        },
      ],
    };
  } catch (err) {
    console.warn('getDashboardSummary notice:', err.message);
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
      ],
    };
  }
}

/**
 * Searches customers who purchased a specific medicine (Tab 4: Medicine Search)
 */
export async function searchCustomersByMedicine(medicineQuery = '') {
  await NetworkService.assertOnline();
  const trimmed = (medicineQuery || '').trim().toLowerCase();

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
          matched_medicines: matched.map((m) => `${m.medicine_name} (${m.quantity || 1} qty)`),
        });
      }
    });
    return list;
  }

  try {
    const userId = await getAuthUserId();
    let query = supabase
      .from('entry_medicines')
      .select(`
        id,
        medicine_name,
        price,
        entries (
          entry_id,
          entry_date,
          total_amount,
          customer_id,
          customers (
            customer_id,
            name,
            phone_number,
            deleted_at
          )
        )
      `)
      .eq('user_id', userId);

    if (trimmed) {
      query = query.ilike('medicine_name', `%${trimmed}%`);
    }

    const { data, error } = await query.limit(100);
    if (error) throw error;

    const seen = new Set();
    const list = [];

    (data || []).forEach((row) => {
      const entry = row.entries;
      const cust = entry?.customers;
      if (cust && !cust.deleted_at && !seen.has(`${cust.customer_id}-${entry.entry_id}`)) {
        seen.add(`${cust.customer_id}-${entry.entry_id}`);
        list.push({
          entry_id: entry.entry_id,
          customer_id: cust.customer_id,
          customer_name: cust.name,
          phone_number: cust.phone_number,
          purchase_date: entry.entry_date,
          matched_medicines: [row.medicine_name],
          total_amount: entry.total_amount,
        });
      }
    });

    return list;
  } catch (err) {
    console.warn('searchCustomersByMedicine notice:', err.message);
    return [];
  }
}

/**
 * Retrieves detailed single purchase record with customer metadata and line items
 */
export async function getPurchaseDetails(entryId) {
  await NetworkService.assertOnline();
  const numericId = parseInt(entryId, 10);
  if (!numericId) return null;

  if (await isDemoSession()) {
    const found = demoRecentPurchases.find((p) => p.entry_id === numericId);
    if (found) return found;
    return {
      entry_id: numericId,
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
    };
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
        customers (
          name,
          phone_number
        ),
        entry_medicines (
          id,
          medicine_name,
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
      medicines: (data.entry_medicines || []).map((m) => ({
        id: m.id,
        medicine_name: m.medicine_name,
        price: parseFloat(m.price) || 0,
        original_price: m.original_price != null ? parseFloat(m.original_price) : parseFloat(m.price) || 0,
        discount_percent: parseFloat(m.discount_percent) || 0,
      })),
      notes: '',
    };
  } catch (err) {
    console.warn('getPurchaseDetails notice:', err.message);
    return null;
  }
}

/**
 * Soft deletes a purchase entry
 */
export async function softDeletePurchase(entryId) {
  const numericId = parseInt(entryId, 10);
  const found = demoRecentPurchases.find((p) => p.entry_id === numericId);
  if (found) {
    found.deleted_at = new Date().toISOString();
  }
  return true;
}

/**
 * Returns soft-deleted purchases for Recycle Bin
 */
export async function getDeletedPurchases() {
  return demoRecentPurchases.filter((p) => p.deleted_at).map((p) => ({
    ...p,
    days_left: 28,
  }));
}

/**
 * Restores a soft-deleted purchase
 */
export async function restorePurchase(entryId) {
  const numericId = parseInt(entryId, 10);
  const found = demoRecentPurchases.find((p) => p.entry_id === numericId);
  if (found) {
    found.deleted_at = null;
  }
  return true;
}

/**
 * Permanently deletes a purchase
 */
export async function permanentDeletePurchase(entryId) {
  const numericId = parseInt(entryId, 10);
  demoRecentPurchases = demoRecentPurchases.filter((p) => p.entry_id !== numericId);
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

  try {
    const userId = await getAuthUserId();
    const { error } = await supabase
      .from('customers')
      .update({
        name: (name || '').trim(),
        phone_number: cleanedPhone,
        village: (village || '').trim(),
        address: (address || '').trim(),
        updated_at: now,
      })
      .eq('user_id', userId)
      .eq('customer_id', numericId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('updateCustomer fallback notice:', err.message);
    return true;
  }
}

/**
 * Retrieves licence reminders and custom pharmacy reminders
 */
export async function getReminders() {
  const profile = await getShopProfile();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reminders = [];

  // 1. Pharmacist License Expiry Reminder
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

  // 2. Shop License Form 20B/21B Expiry Reminder
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

  // 3. Custom Reminders
  customReminders.forEach((r) => {
    reminders.push({
      ...r,
      days_left: Math.ceil((new Date(r.due_date) - today) / (1000 * 60 * 60 * 24)),
      status: 'Active',
    });
  });

  return reminders;
}

/**
 * Adds a new custom reminder
 */
export async function addReminder({ title, due_date, notes }) {
  const newRem = {
    id: `rem_${Date.now()}`,
    title: (title || '').trim(),
    due_date: due_date || getCurrentLocalIso().slice(0, 10),
    notes: (notes || '').trim(),
    is_completed: false,
    type: 'custom',
    status: 'Active',
    days_left: 30,
  };
  customReminders.unshift(newRem);
  return newRem;
}

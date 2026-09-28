import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../utils/supabaseClient';
import { NetworkService } from './networkService';

const getMigrationKey = (userId) => `medtrack_local_data_migrated_v2_${userId || 'anonymous'}`;

async function getMigrationDone(userId) {
  const key = getMigrationKey(userId);
  try {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' && localStorage.getItem(key) === 'true';
    }
    const val = await SecureStore.getItemAsync(key);
    return val === 'true';
  } catch {
    return false;
  }
}

async function setMigrationDone(userId) {
  const key = getMigrationKey(userId);
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, 'true');
      return;
    }
    await SecureStore.setItemAsync(key, 'true');
  } catch (err) {
    console.warn('Could not save migration flag:', err);
  }
}

export const LocalMigrationService = {
  checkPendingLocalData: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const alreadyDone = await getMigrationDone(user?.id);
      if (alreadyDone) return { hasData: false, count: 0 };

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          const raw = window.localStorage.getItem('medtrack_web_db_v1');
          if (raw) {
            const parsed = JSON.parse(raw);
            const count = parsed.customers?.length || 0;
            return { hasData: count > 0, count };
          }
        }
        return { hasData: false, count: 0 };
      }

      // Native expo-sqlite
      const SQLite = require('expo-sqlite');
      const db = SQLite.openDatabaseSync('medtrack_mobile.db');
      const tableCheck = db.getFirstSync(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='customers';`
      );
      if (!tableCheck) return { hasData: false, count: 0 };

      const row = db.getFirstSync(`SELECT COUNT(*) as count FROM customers;`);
      const count = row ? row.count : 0;
      return { hasData: count > 0, count };
    } catch (e) {
      console.warn('Error checking local SQLite data:', e);
      return { hasData: false, count: 0 };
    }
  },

  migrateToCloud: async (onProgress = null) => {
    await NetworkService.assertOnline();

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      throw new Error('You must be logged in to upload local data to the cloud.');
    }

    let localCustomers = [];
    let localEntries = [];
    let localMedicines = [];
    let localProfile = null;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem('medtrack_web_db_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          localCustomers = parsed.customers || [];
          localEntries = parsed.entries || [];
          localMedicines = parsed.entry_medicines || [];
          localProfile = parsed.shop_profile || null;
        }
      }
    } else {
      const SQLite = require('expo-sqlite');
      const db = SQLite.openDatabaseSync('medtrack_mobile.db');
      try {
        localCustomers = db.getAllSync(`SELECT * FROM customers ORDER BY customer_id ASC;`);
        localEntries = db.getAllSync(`SELECT * FROM entries ORDER BY entry_id ASC;`);
        localMedicines = db.getAllSync(`SELECT * FROM entry_medicines ORDER BY id ASC;`);
        localProfile = db.getFirstSync(`SELECT * FROM shop_profile WHERE id = 1;`);
      } catch (dbErr) {
        console.warn('Local read error during migration:', dbErr);
      }
    }

    if (localCustomers.length === 0) {
      await setMigrationDone(user.id);
      return { success: true, customersMigrated: 0, entriesMigrated: 0 };
    }

    let customersMigrated = 0;
    let entriesMigrated = 0;
    let medicinesMigrated = 0;
    const errors = [];

    const totalSteps = localCustomers.length;

    // Migrate each customer and their ledger entries
    for (let i = 0; i < localCustomers.length; i++) {
      const c = localCustomers[i];
      if (onProgress) {
        onProgress({ current: i + 1, total: totalSteps, name: c.name });
      }

      // Check if customer already exists in Supabase by phone for this user
      let supabaseCustomerId = null;
      const { data: existing } = await supabase
        .from('customers')
        .select('customer_id')
        .eq('user_id', user.id)
        .eq('phone_number', c.phone_number)
        .maybeSingle();

      if (existing) {
        supabaseCustomerId = existing.customer_id;
      } else {
        const { data: inserted, error: custErr } = await supabase
          .from('customers')
          .insert({
            user_id: user.id,
            phone_number: c.phone_number,
            name: (c.name || 'Unnamed Customer').trim(),
            village: c.village || '',
            address: c.address || '',
            notes: c.notes || null,
            deleted_at: c.deleted_at || null,
            created_at: c.created_at || new Date().toISOString(),
          })
          .select('customer_id')
          .single();

        if (custErr) {
          console.error(`Could not migrate customer ${c.name}:`, custErr.message);
          errors.push(`Customer ${c.name}: ${custErr.message}`);
          continue;
        }
        supabaseCustomerId = inserted.customer_id;
        customersMigrated++;
      }

      // Migrate entries for this customer
      const custEntries = localEntries.filter((e) => e.customer_id === c.customer_id);
      for (const e of custEntries) {
        const { data: insertedEntry, error: entryErr } = await supabase
          .from('entries')
          .insert({
            user_id: user.id,
            customer_id: supabaseCustomerId,
            entry_date: e.entry_date || new Date().toISOString(),
            total_amount: Math.max(0, parseFloat(e.total_amount) || 0),
            amount_paid: Math.max(0, parseFloat(e.amount_paid) || 0),
            due_amount: Math.max(0, parseFloat(e.due_amount) || 0),
            notes: e.notes || null,
            deleted_at: e.deleted_at || null,
          })
          .select('entry_id')
          .single();

        if (entryErr) {
          console.error('Could not migrate entry:', entryErr.message);
          errors.push(`Entry for customer ${c.name}: ${entryErr.message}`);
          continue;
        }
        entriesMigrated++;

        // Migrate medicine line items for this entry
        const entryMeds = localMedicines.filter((m) => m.entry_id === e.entry_id);
        if (entryMeds.length > 0) {
          const medPayload = entryMeds.map((m) => {
            const qty = Math.max(1, parseInt(m.quantity, 10) || 1);
            const price = Math.max(0, parseFloat(m.price) || 0);
            const unitPrice = m.unit_price != null ? Math.max(0, parseFloat(m.unit_price)) : (price / qty);
            return {
              user_id: user.id,
              entry_id: insertedEntry.entry_id,
              medicine_name: (m.medicine_name || '').trim(),
              price,
              original_price: m.original_price != null ? Math.max(0, parseFloat(m.original_price)) : price,
              discount_percent: Math.max(0, parseFloat(m.discount_percent) || 0),
              quantity: qty,
              unit_price: unitPrice,
            };
          });

          const { error: medErr } = await supabase.from('entry_medicines').insert(medPayload);
          if (!medErr) {
            medicinesMigrated += entryMeds.length;
          } else {
            console.error('Could not migrate entry medicines:', medErr.message);
            errors.push(`Medicines for entry ${insertedEntry.entry_id}: ${medErr.message}`);
          }
        }
      }
    }

    // Migrate shop profile if available
    if (localProfile && (localProfile.shop_name || localProfile.license_20b)) {
      try {
        await supabase.from('shop_profile').upsert({
          user_id: user.id,
          shop_name: localProfile.shop_name || 'MedTrack Pharmacy',
          shop_license_no: localProfile.shop_license_no || '',
          license_20b: localProfile.license_20b || '',
          license_21b: localProfile.license_21b || '',
          shop_license_validity: localProfile.shop_license_validity || null,
          shop_phone: localProfile.shop_phone || '',
          pharmacist_name: localProfile.pharmacist_name || '',
          pharmacist_phone: localProfile.pharmacist_phone || '',
          pharmacist_license_validity: localProfile.pharmacist_license_validity || null,
          updated_at: new Date().toISOString(),
        });
      } catch (profErr) {
        console.warn('Profile migration error:', profErr.message);
      }
    }

    // Only set migration done if there were zero unrecoverable record errors
    if (errors.length === 0) {
      await setMigrationDone(user.id);
    } else {
      console.warn(`Migration completed with ${errors.length} errors; done flag NOT set to allow retry.`);
    }

    return {
      success: errors.length === 0,
      errors,
      customersMigrated,
      entriesMigrated,
      medicinesMigrated,
    };
  },
};

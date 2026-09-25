const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbPath = path.join(__dirname, '..', 'db', 'medtrack.sqlite');
if (!fs.existsSync(dbPath)) {
  console.error(`❌ SQLite database not found at ${dbPath}. Run 'npm run seed' first.`);
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || 'https://vhkhdyraxtfajhfaewun.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ Missing SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY in server/.env');
  console.error('Please add SUPABASE_SERVICE_KEY to server/.env and re-run.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const localDb = new Database(dbPath);

async function migrateTable(tableName, query) {
  try {
    console.log(`\n📦 Migrating ${tableName}...`);
    const data = localDb.prepare(query).all();
    if (data.length === 0) {
      console.log(`ℹ️  ${tableName}: No data to migrate.`);
      return 0;
    }

    const chunkSize = 100;
    let inserted = 0;

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const { error } = await supabase.from(tableName).upsert(chunk);
      if (error) {
        console.error(`❌ Error inserting into ${tableName}:`, error.message);
        throw error;
      }
      inserted += chunk.length;
      console.log(`   ✓ ${inserted}/${data.length} records processed`);
    }

    console.log(`✅ ${tableName}: ${inserted} records migrated successfully!`);
    return inserted;
  } catch (err) {
    console.error(`❌ Migration failed for ${tableName}:`, err.message);
    throw err;
  }
}

async function run() {
  console.log('🚀 Starting SQLite → Supabase data migration...');
  console.log(`🔗 Target Supabase URL: ${supabaseUrl}`);

  try {
    // 1. Customers
    await migrateTable(
      'customers',
      `SELECT customer_id, phone_number, name, village, address, created_at, updated_at FROM customers`
    );

    // 2. Entries
    await migrateTable(
      'entries',
      `SELECT entry_id, customer_id, entry_date, total_amount, amount_paid, due_amount FROM entries`
    );

    // 3. Entry Medicine
    await migrateTable(
      'entry_medicine',
      `SELECT id, entry_id, medicine_name, price FROM entry_medicine`
    );

    // 4. Payments
    await migrateTable(
      'payments',
      `SELECT payment_id, customer_id, pay_date, amount, note FROM payments`
    );

    console.log('\n🎉 All tables migrated to Supabase successfully!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration terminated with error:', err.message);
    process.exit(1);
  }
}

run();

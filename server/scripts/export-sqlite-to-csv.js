const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'db', 'medtrack.sqlite');
const exportDir = path.join(__dirname, '..', 'export');

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

const db = new Database(dbPath);

function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportTable(tableName, query) {
  const rows = db.prepare(query).all();
  if (rows.length === 0) {
    console.log(`⚠️  ${tableName}: 0 rows found.`);
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map(h => escapeCsvField(row[h]));
    lines.push(values.join(','));
  }
  const dest = path.join(exportDir, `${tableName}.csv`);
  fs.writeFileSync(dest, lines.join('\n'), 'utf8');
  console.log(`✅ Exported ${tableName}: ${rows.length} records -> ${dest}`);
}

console.log('🚀 Exporting SQLite tables to CSV...');
exportTable('customers', 'SELECT customer_id, phone_number, name, village, address, created_at, updated_at FROM customers');
exportTable('entries', 'SELECT entry_id, customer_id, entry_date, total_amount, amount_paid, due_amount FROM entries');
exportTable('entry_medicine', 'SELECT id, entry_id, medicine_name, price FROM entry_medicine');
exportTable('payments', 'SELECT payment_id, customer_id, pay_date, amount, note FROM payments');
console.log('🎉 CSV export completed!');

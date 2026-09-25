-- ============================================
-- MEDTRACK COMPLETE SUPABASE (POSTGRESQL) SCHEMA
-- ============================================

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  customer_id BIGSERIAL PRIMARY KEY,
  phone_number VARCHAR(15) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  village VARCHAR(100),
  address TEXT,
  total_due NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Entries (purchases)
CREATE TABLE IF NOT EXISTS entries (
  entry_id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(customer_id),
  entry_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_amount NUMERIC(10, 2) NOT NULL,
  amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
  due_amount NUMERIC(10, 2) NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Entry medicine items
CREATE TABLE IF NOT EXISTS entry_medicine (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES entries(entry_id) ON DELETE CASCADE,
  medicine_name VARCHAR(255) NOT NULL,
  quantity INT DEFAULT 1,
  price NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  payment_id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(customer_id),
  pay_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  amount NUMERIC(10, 2) NOT NULL,
  note TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync metadata (for mobile sync)
CREATE TABLE IF NOT EXISTS sync_metadata (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID UNIQUE,
  last_successful_sync_at TIMESTAMP WITH TIME ZONE,
  pending_changes_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  operation VARCHAR(10),
  record_id BIGINT,
  changed_by VARCHAR(100),
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);
CREATE INDEX IF NOT EXISTS idx_customers_village ON customers(village);
CREATE INDEX IF NOT EXISTS idx_customers_deleted ON customers(is_deleted);
CREATE INDEX IF NOT EXISTS idx_entries_customer ON entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_entries_deleted ON entries(is_deleted);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(pay_date);
CREATE INDEX IF NOT EXISTS idx_payments_deleted ON payments(is_deleted);
CREATE INDEX IF NOT EXISTS idx_entry_medicine_entry ON entry_medicine(entry_id);
CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name, changed_at);

-- Disable RLS by default so API / server has access without policies, or can be enabled later
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE entry_medicine DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metadata DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

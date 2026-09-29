-- ====================================================================
-- MedTrack Mobile & Web Consolidated Supabase Postgres Schema
-- Full multi-tenant schema with mandatory Row Level Security (RLS)
-- Enforces cross-tenant composite foreign keys and non-negative constraints
-- Each authenticated user (pharmacist) has isolated access via auth.uid()
-- ====================================================================

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
  customer_id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL CHECK (length(trim(name)) > 0),
  village VARCHAR(255) DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_user_customer_phone UNIQUE (user_id, phone_number),
  CONSTRAINT uq_user_customer_id UNIQUE (user_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON public.customers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone_number);

-- 2. Entries (Ledger Transactions) Table
CREATE TABLE IF NOT EXISTS public.entries (
  entry_id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL,
  entry_date TIMESTAMPTZ DEFAULT NOW(),
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  due_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_user_entry_id UNIQUE (user_id, entry_id),
  CONSTRAINT fk_entries_customer FOREIGN KEY (user_id, customer_id)
    REFERENCES public.customers(user_id, customer_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entries_user_id ON public.entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_customer_id ON public.entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_entries_deleted_at ON public.entries(deleted_at);
CREATE INDEX IF NOT EXISTS idx_entries_date ON public.entries(entry_date DESC);

-- 3. Entry Medicines (Purchase Line Items) Table
CREATE TABLE IF NOT EXISTS public.entry_medicines (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id BIGINT NOT NULL,
  medicine_name VARCHAR(255) NOT NULL CHECK (length(trim(medicine_name)) > 0),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  original_price NUMERIC(10, 2) DEFAULT NULL,
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_entry_meds_entry FOREIGN KEY (user_id, entry_id)
    REFERENCES public.entries(user_id, entry_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entry_meds_user_id ON public.entry_medicines(user_id);
CREATE INDEX IF NOT EXISTS idx_entry_meds_entry_id ON public.entry_medicines(entry_id);

-- 4. Shop & Pharmacist Profile Table
CREATE TABLE IF NOT EXISTS public.shop_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name VARCHAR(255) NOT NULL DEFAULT 'MedTrack Pharmacy',
  shop_license_no VARCHAR(100) DEFAULT '',
  license_20b VARCHAR(100) DEFAULT '',
  license_21b VARCHAR(100) DEFAULT '',
  shop_license_validity DATE DEFAULT NULL,
  shop_phone VARCHAR(20) DEFAULT '',
  pharmacist_name VARCHAR(255) DEFAULT '',
  pharmacist_phone VARCHAR(20) DEFAULT '',
  pharmacist_license_validity DATE DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Payments Table (for standalone settlement payments)
CREATE TABLE IF NOT EXISTS public.payments (
  payment_id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount > 0),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_payments_customer FOREIGN KEY (user_id, customer_id)
    REFERENCES public.customers(user_id, customer_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);

-- Atomic Purchase Transaction Function (ACID single-transaction purchase insertion)
CREATE OR REPLACE FUNCTION public.create_purchase_atomic(
  p_customer_id BIGINT,
  p_total_amount NUMERIC,
  p_amount_paid NUMERIC,
  p_due_amount NUMERIC,
  p_notes TEXT,
  p_medicines JSONB
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_entry_id BIGINT;
  v_med JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_total_amount < 0 OR p_amount_paid < 0 THEN
    RAISE EXCEPTION 'Amounts must be non-negative';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE user_id = v_user_id AND customer_id = p_customer_id) THEN
    RAISE EXCEPTION 'Customer does not belong to authenticated user';
  END IF;

  INSERT INTO public.entries (user_id, customer_id, entry_date, total_amount, amount_paid, due_amount, notes)
  VALUES (v_user_id, p_customer_id, NOW(), p_total_amount, p_amount_paid, p_due_amount, p_notes)
  RETURNING entry_id INTO v_entry_id;

  IF p_medicines IS NOT NULL AND jsonb_array_length(p_medicines) > 0 THEN
    FOR v_med IN SELECT * FROM jsonb_array_elements(p_medicines)
    LOOP
      INSERT INTO public.entry_medicines (
        user_id,
        entry_id,
        medicine_name,
        quantity,
        unit_price,
        price,
        original_price,
        discount_percent
      ) VALUES (
        v_user_id,
        v_entry_id,
        v_med->>'medicine_name',
        COALESCE((v_med->>'quantity')::INTEGER, 1),
        COALESCE((v_med->>'unit_price')::NUMERIC, 0),
        COALESCE((v_med->>'price')::NUMERIC, 0),
        (v_med->>'original_price')::NUMERIC,
        COALESCE((v_med->>'discount_percent')::NUMERIC, 0)
      );
    END LOOP;
  END IF;

  RETURN v_entry_id;
END;
$$;

-- Compatibility view for backend scripts referencing singular entry_medicine
CREATE OR REPLACE VIEW public.entry_medicine AS
SELECT id, user_id, entry_id, medicine_name, quantity, unit_price, price, original_price, discount_percent, created_at
FROM public.entry_medicines;

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- MANDATORY: Every authenticated user can ONLY access their own records
-- ====================================================================

-- Customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pharmacists can manage own customers" ON public.customers;
CREATE POLICY "Pharmacists can manage own customers"
  ON public.customers
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Entries
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pharmacists can manage own entries" ON public.entries;
CREATE POLICY "Pharmacists can manage own entries"
  ON public.entries
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Entry Medicines
ALTER TABLE public.entry_medicines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pharmacists can manage own entry medicines" ON public.entry_medicines;
CREATE POLICY "Pharmacists can manage own entry medicines"
  ON public.entry_medicines
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Shop Profile
ALTER TABLE public.shop_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pharmacists can manage own shop profile" ON public.shop_profile;
CREATE POLICY "Pharmacists can manage own shop profile"
  ON public.shop_profile
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pharmacists can manage own payments" ON public.payments;
CREATE POLICY "Pharmacists can manage own payments"
  ON public.payments
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

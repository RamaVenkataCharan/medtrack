-- ====================================================================
-- MedTrack Supabase / PostgreSQL Schema Migration
-- Migration 001: Soft-Delete, Shop Profile & Line Item Discounts
-- ====================================================================

-- 1. Soft-Delete on Customers
ALTER TABLE IF EXISTS customers
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_deleted_at
  ON customers(deleted_at);

-- 2. Line Item Discounts on Entry Medicines
ALTER TABLE IF EXISTS entry_medicine
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) DEFAULT 0;

ALTER TABLE IF EXISTS entry_medicine
  ADD COLUMN IF NOT EXISTS original_price NUMERIC(10, 2) DEFAULT NULL;

-- 3. Dedicated Shop & Pharmacist Profile Table
CREATE TABLE IF NOT EXISTS shop_profile (
  id SERIAL PRIMARY KEY,
  shop_name TEXT NOT NULL DEFAULT 'MedTrack Pharmacy',
  license_20b TEXT DEFAULT NULL,
  license_21b TEXT DEFAULT NULL,
  shop_license_validity DATE DEFAULT NULL,
  shop_phone TEXT DEFAULT NULL,
  pharmacist_name TEXT DEFAULT NULL,
  pharmacist_phone TEXT DEFAULT NULL,
  pharmacist_license_validity DATE DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial shop profile record if table is empty
INSERT INTO shop_profile (
  id,
  shop_name,
  license_20b,
  license_21b,
  shop_license_validity,
  shop_phone,
  pharmacist_name,
  pharmacist_phone,
  pharmacist_license_validity
)
SELECT
  1,
  'MedTrack Pharmacy',
  'AP/NZB/20B/2024-9871',
  'AP/NZB/21B/2024-9872',
  '2028-12-31',
  '9848012345',
  'R. Venkata Charan',
  '9493972442',
  '2029-06-30'
WHERE NOT EXISTS (SELECT 1 FROM shop_profile WHERE id = 1);

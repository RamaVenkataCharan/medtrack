-- ====================================================================
-- MedTrack Supabase / PostgreSQL Schema Migration
-- Migration 002: Users (Shop & Pharmacist Profile) & Recycle Bin
-- ====================================================================

-- 1. Users table (tied to Supabase Auth users)
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  
  -- Shop Information
  shop_name VARCHAR(255) NOT NULL DEFAULT 'MedTrack Pharmacy',
  shop_license_number VARCHAR(100) NOT NULL DEFAULT 'DL-20B/21B-54892',
  shop_license_validity DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '3 years'),
  shop_phone_number VARCHAR(15) NOT NULL DEFAULT '+91 98765 43210',
  
  -- Pharmacist Information
  pharmacist_name VARCHAR(255) NOT NULL DEFAULT 'Registered Pharmacist',
  pharmacist_phone_number VARCHAR(15) NOT NULL DEFAULT '9848012345',
  pharmacist_license_number VARCHAR(100) NOT NULL DEFAULT 'REG-PHARM-9848',
  pharmacist_validity DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '5 years'),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Enable Row Level Security (RLS) on users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and edit their own profile"
  ON users
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Recycle Bin table (detailed snapshots of soft-deleted customers)
CREATE TABLE IF NOT EXISTS recycle_bin (
  id BIGSERIAL PRIMARY KEY,
  deleted_customer_id BIGINT NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(15) NOT NULL,
  customer_data JSONB, -- Stores full customer record & purchase snapshot
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  restored_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  permanently_deleted BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recycle_deleted_at ON recycle_bin(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_recycle_deleted_by ON recycle_bin(deleted_by);
CREATE INDEX IF NOT EXISTS idx_recycle_customer_id ON recycle_bin(deleted_customer_id);

-- Enable RLS on recycle_bin
ALTER TABLE recycle_bin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access recycle bin"
  ON recycle_bin
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

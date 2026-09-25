/*
  Migration: 001_add_sync_columns.js
  Purpose: Extend existing SQLite schema with sync metadata, soft‑delete flags, and server‑ID mapping.
  This migration is non‑breaking – new columns are nullable/defaulted, so existing rows remain valid.
*/

import Database from 'better-sqlite3';

/**
 * Run migration against a better‑sqlite3 Database instance.
 * @param {Database} db – Open SQLite connection used by the server.
 */
export function migrate(db) {
  console.log('📦 Running migration: add_sync_columns...');

  const statements = [
    // ---- Customers ----
     ALTER TABLE customers ADD COLUMN server_id INTEGER UNIQUE,
    ALTER TABLE customers ADD COLUMN sync_status TEXT DEFAULT pending ,
     ALTER TABLE customers ADD COLUMN device_created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    ALTER TABLE customers ADD COLUMN is_deleted INTEGER DEFAULT 0,
    ALTER TABLE customers ADD COLUMN deleted_at TEXT,
    // ---- Entries ----
    ALTER TABLE entries ADD COLUMN server_id INTEGER UNIQUE,
    ALTER TABLE entries ADD COLUMN sync_status TEXT DEFAULT pending ,
     ALTER TABLE entries ADD COLUMN is_deleted INTEGER DEFAULT 0,
    ALTER TABLE entries ADD COLUMN deleted_at TEXT,
    // ---- Payments ----
    ALTER TABLE payments ADD COLUMN server_id INTEGER UNIQUE,
    ALTER TABLE payments ADD COLUMN sync_status TEXT DEFAULT pending ,
     ALTER TABLE payments ADD COLUMN is_deleted INTEGER DEFAULT 0,
    ALTER TABLE payments ADD COLUMN deleted_at TEXT,
    // ---- Sync metadata & log tables (idempotent) ----
    CREATE TABLE IF NOT EXISTS sync_metadata (
      id INTEGER PRIMARY KEY,
      last_successful_sync_at TEXT,
      last_sync_attempt_at TEXT,
      last_sync_error TEXT,
      sync_in_progress INTEGER DEFAULT 0,
      device_id TEXT UNIQUE,
      pending_changes_count INTEGER DEFAULT 0
    ),
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL,
      rows_affected INTEGER,
      started_at TEXT,
      completed_at TEXT,
      error TEXT,
      FOREIGN KEY (table_name) REFERENCES sqlite_master(name)
    )
  ];

  for (const sql of statements) {
    try {
      db.exec(sql);
      console.log(✅ Executed:  ...);
    } catch (err) {
      // SQLite throws duplicate column if we rerun the migration – ignore safely.
      if (err.message.includes('duplicate column') || err.message.includes('already exists')) {
        console.log('⏭️  Column or table already exists, skipping');
      } else {
        console.error('❌ Migration error:', err.message);
        throw err; // re‑throw unexpected errors so the startup fails fast
      }
    }
  }

  console.log('✅ Migration 001_add_sync_columns complete');
}

// Example usage (usually from server entry point):
// import { migrate } from './db/migrations/001_add_sync_columns.js';
// const db = new Database('medcust.db');
// migrate(db);

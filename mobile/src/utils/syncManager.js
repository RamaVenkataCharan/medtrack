// mobile/src/utils/syncManager.js
// Core sync manager for Medcust Expo app (offline‑first).
// Handles queuing changes, push/pull cycles, conflict handling,
// automatic scheduling, and UI‑visible sync state.

import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { getOrCreateDeviceId } from './deviceId';

// Open (or create) the local DB used by the app.
const db = SQLite.openDatabase('medcust.db');

// ---------------------------------------------------------------
// Global sync state – UI can subscribe via `global.onSyncStateChange`.
// ---------------------------------------------------------------
export const syncState = {
  isSyncing: false,
  lastSyncTime: null,
  lastError: null,
  pendingCount: 0,
  conflicts: [],
};

export function setSyncState(updates) {
  Object.assign(syncState, updates);
  if (global.onSyncStateChange) {
    global.onSyncStateChange({ ...syncState });
  }
}

// ---------------------------------------------------------------
// 1️⃣ Queue a local change (create / update / delete).
// ---------------------------------------------------------------
export async function queueChange(table, operation, data, localId) {
  // Mark the row as pending and update its timestamp.
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      const pk = `${table.slice(0, -1)}_id`; // e.g., customers -> customer_id
      const sql = `UPDATE ${table} SET sync_status = ?, updated_at = ? WHERE ${pk} = ?`;
      tx.executeSql(
        sql,
        ['pending', new Date().toISOString(), localId],
        () => resolve(),
        (_, err) => reject(err)
      );
    })();
  });
}

/** Gather all pending rows across tables. */
export async function getPendingChanges() {
  const changes = [];
  const fetch = (table, pk) =>
    new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `SELECT * FROM ${table} WHERE sync_status = 'pending'`,
          [],
          (_, { rows }) => {
            rows._array.forEach((row) => {
              const operation = row.server_id ? 'update' : 'create';
              changes.push({
                table,
                operation,
                local_id: row[pk],
                data: row,
              });
            });
            resolve();
          },
          (_, err) => reject(err)
        );
      })();
    });

  await Promise.all([
    fetch('customers', 'customer_id'),
    fetch('entries', 'entry_id'),
    fetch('payments', 'payment_id'),
  ]);

  return changes;
}

// ---------------------------------------------------------------
// 2️⃣ Push local changes to server.
// ---------------------------------------------------------------
export async function pushToServer(serverUrl, deviceId) {
  const changes = await getPendingChanges();
  if (!changes.length) {
    console.log('✅ No pending changes to push');
    return { success: true, processed: 0, conflicts: [] };
  }

  const resp = await fetch(`${serverUrl}/api/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes, device_id: deviceId, since: syncState.lastSyncTime }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Push failed ${resp.status}: ${txt}`);
  }

  const result = await resp.json();
  if (result.conflicts?.length) {
    setSyncState({ conflicts: result.conflicts });
  }

  // Mark successfully pushed rows as synced.
  await new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        "UPDATE customers SET sync_status = 'synced' WHERE sync_status = 'pending'",
        [],
        () => resolve(),
        (_, err) => reject(err)
      );
    })();
  });

  return result;
}

// ---------------------------------------------------------------
// 3️⃣ Pull server changes.
// ---------------------------------------------------------------
export async function pullFromServer(serverUrl, deviceId) {
  const resp = await fetch(`${serverUrl}/api/sync/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, since: syncState.lastSyncTime || '1970-01-01T00:00:00Z' }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Pull failed ${resp.status}: ${txt}`);
  }

  const { changes } = await resp.json();
  if (!changes?.length) {
    console.log('✅ No new changes from server');
    return { success: true, pulled: 0 };
  }

  await new Promise((resolve, reject) => {
    db.transaction((tx) => {
      changes.forEach(({ table, data }) => {
        const cols = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const sql = `INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${placeholders})`;
        tx.executeSql(sql, Object.values(data));
      });
      resolve();
    })();
  });

  console.log(`✅ Pulled ${changes.length} records`);
  return { success: true, pulled: changes.length };
}

// ---------------------------------------------------------------
// 4️⃣ Full sync (push + pull) with retries.
// ---------------------------------------------------------------
export async function performSync(serverUrl, maxRetries = 3) {
  if (syncState.isSyncing) {
    console.warn('⚠️ Sync already in progress');
    return { success: false, error: 'already_running' };
  }

  setSyncState({ isSyncing: true, lastError: null, conflicts: [] });
  const deviceId = await getOrCreateDeviceId();
  let attempt = 0;
  let lastErr = null;

  while (attempt < maxRetries) {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) throw new Error('No network');

      await pushToServer(serverUrl, deviceId);
      await pullFromServer(serverUrl, deviceId);

      const now = new Date().toISOString();
      // Update sync_metadata table.
      await new Promise((resolve, reject) => {
        db.transaction((tx) => {
          tx.executeSql(
            'UPDATE sync_metadata SET last_successful_sync_at = ?, last_sync_error = NULL, pending_changes_count = 0 WHERE id = 1',
            [now],
            () => resolve(),
            (_, err) => reject(err)
          );
        })();
      });

      setSyncState({ isSyncing: false, lastSyncTime: now, pendingCount: 0 });
      console.log('✅ Sync completed');
      return { success: true };
    } catch (e) {
      lastErr = e;
      attempt++;
      console.warn(`⚠️ Sync attempt ${attempt} failed: ${e.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }

  setSyncState({ isSyncing: false, lastError: `Sync failed after ${maxRetries} attempts: ${lastErr.message}` });
  return { success: false, error: lastErr.message };
}

// ---------------------------------------------------------------
// 5️⃣ Auto‑sync scheduler.
// ---------------------------------------------------------------
let intervalId = null;
export function startAutoSync(serverUrl, minutes = 5) {
  if (intervalId) return;
  console.log(`⏲️  Auto‑sync every ${minutes} min`);
  intervalId = setInterval(async () => {
    if (syncState.isSyncing) return;
    const net = await NetInfo.fetch();
    if (net.isConnected) await performSync(serverUrl);
  }, minutes * 60 * 1000);
}

export function stopAutoSync() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('⏹️  Auto‑sync stopped');
  }
}

// Helper for UI badge count.
export async function getPendingCount() {
  return new Promise((resolve) => {
    db.transaction((tx) => {
      tx.executeSql(
        `SELECT COUNT(*) as cnt FROM (
          SELECT 1 FROM customers WHERE sync_status = 'pending'
          UNION ALL SELECT 1 FROM entries WHERE sync_status = 'pending'
          UNION ALL SELECT 1 FROM payments WHERE sync_status = 'pending'
        )`,
        [],
        (_, { rows }) => resolve(rows.item(0).cnt),
        () => resolve(0)
      );
    })();
  });
}

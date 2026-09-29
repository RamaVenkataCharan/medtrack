import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const QUEUE_STORAGE_KEY = 'medtrack_offline_mutation_queue_v1';
const syncListeners = new Set();

let memoryQueue = [];

async function getStoredQueue() {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      }
      return memoryQueue;
    }
    const raw = await SecureStore.getItemAsync(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed to read offline queue from storage:', err);
    return memoryQueue;
  }
}

async function persistQueue(queue) {
  memoryQueue = queue;
  try {
    const json = JSON.stringify(queue);
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(QUEUE_STORAGE_KEY, json);
      }
      return;
    }
    await SecureStore.setItemAsync(QUEUE_STORAGE_KEY, json);
  } catch (err) {
    console.warn('Failed to persist offline queue:', err);
  }
}

function notifySyncStatus(status) {
  syncListeners.forEach((cb) => {
    try {
      cb(status);
    } catch (e) {
      console.warn('Sync status listener error:', e);
    }
  });
}

export const OfflineSyncService = {
  /**
   * Generates a collision-resistant unique mutation ID for deduplication
   */
  generateMutationId: () => {
    return 'mut_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  },

  /**
   * Enqueues an offline action for background cloud synchronization
   */
  enqueueMutation: async ({ type, payload }) => {
    const queue = await getStoredQueue();
    const mutation = {
      mutation_id: payload.client_mutation_id || OfflineSyncService.generateMutationId(),
      type,
      payload,
      created_at: new Date().toISOString(),
      retry_count: 0,
      status: 'pending',
    };

    queue.push(mutation);
    await persistQueue(queue);
    notifySyncStatus({ status: 'queued', pendingCount: queue.length });
    return mutation;
  },

  /**
   * Retrieves current list of pending mutations
   */
  getPendingCount: async () => {
    const queue = await getStoredQueue();
    return queue.length;
  },

  /**
   * Checks if a specific entry ID or client mutation ID has a pending sync
   */
  hasPendingMutationForId: async (id) => {
    const queue = await getStoredQueue();
    return queue.some(
      (m) =>
        m.payload.entryId === id ||
        m.payload.entry_id === id ||
        m.payload.customerId === id ||
        m.mutation_id === id
    );
  },

  /**
   * Synchronizes all pending mutations with Supabase Cloud
   */
  syncPendingMutations: async (dbModule) => {
    const queue = await getStoredQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    notifySyncStatus({ status: 'syncing', pendingCount: queue.length });

    let db = dbModule;
    if (!db) {
      try {
        db = await import('../db/database.js');
      } catch (err) {
        console.warn('Could not dynamically import database module:', err);
      }
    }
    const remaining = [];
    let syncedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      try {
        switch (item.type) {
          case 'ADD_PURCHASE':
            await db.addPurchaseEntry({ ...item.payload, isSyncReplay: true });
            syncedCount++;
            break;

          case 'UPDATE_PURCHASE':
            await db.updatePurchaseEntry({ ...item.payload, isSyncReplay: true });
            syncedCount++;
            break;

          case 'ADD_PAYMENT':
            await db.addDuePayment({ ...item.payload, isSyncReplay: true });
            syncedCount++;
            break;

          case 'ADD_CUSTOMER':
            await db.addCustomer({ ...item.payload, isSyncReplay: true });
            syncedCount++;
            break;

          case 'UPDATE_CUSTOMER':
            await db.updateCustomer(item.payload.customerId, { ...item.payload, isSyncReplay: true });
            syncedCount++;
            break;

          case 'SOFT_DELETE_PURCHASE':
            await db.softDeletePurchase(item.payload.entryId);
            syncedCount++;
            break;

          case 'SOFT_DELETE_CUSTOMER':
            await db.softDeleteCustomer(item.payload.customerId);
            syncedCount++;
            break;

          default:
            console.warn('Unknown offline mutation type:', item.type);
            break;
        }

        // Incremental persistence: Remove processed item from queue immediately
        const currentRemaining = [...remaining, ...queue.slice(i + 1)];
        await persistQueue(currentRemaining);
      } catch (err) {
        console.warn(`Sync failed for mutation ${item.mutation_id}:`, err.message);
        item.retry_count = (item.retry_count || 0) + 1;
        item.last_error = err.message;
        // Keep in queue for next sync if transient network error
        if (item.retry_count < 5) {
          remaining.push(item);
        }
        failedCount++;
        const currentRemaining = [...remaining, ...queue.slice(i + 1)];
        await persistQueue(currentRemaining);
      }
    }

    await persistQueue(remaining);
    notifySyncStatus({
      status: remaining.length === 0 ? 'synced' : 'partial',
      pendingCount: remaining.length,
      syncedCount,
      failedCount,
    });

    return { synced: syncedCount, failed: failedCount, remaining: remaining.length };
  },

  /**
   * Subscribes to sync progress and status notifications
   */
  subscribe: (callback) => {
    syncListeners.add(callback);
    getStoredQueue().then((q) => {
      callback({ status: q.length > 0 ? 'pending' : 'idle', pendingCount: q.length });
    });
    return () => syncListeners.delete(callback);
  },

  /**
   * Clears the offline mutation queue (e.g. on account logout or test cleanup)
   */
  clearQueue: async () => {
    memoryQueue = [];
    await persistQueue([]);
    notifySyncStatus({ status: 'idle', pendingCount: 0 });
  },
};

import NetInfo from '@react-native-community/netinfo';
import { OfflineSyncService } from './offlineSyncService.js';

let currentIsConnected = true;
const listeners = new Set();

// Initialize NetInfo listener
NetInfo.addEventListener((state) => {
  const isOnline = Boolean(state.isConnected && (state.isInternetReachable === null || state.isInternetReachable));
  const wasOffline = !currentIsConnected;
  currentIsConnected = isOnline;

  listeners.forEach((cb) => {
    try {
      cb(isOnline);
    } catch (err) {
      console.warn('Network listener error:', err);
    }
  });

  // When connection is restored, trigger automatic sync of pending offline records
  if (isOnline && wasOffline) {
    OfflineSyncService.syncPendingMutations().catch((err) => {
      console.warn('Auto-sync on reconnect notice:', err.message);
    });
  }
});

export const NetworkService = {
  isOnline: () => currentIsConnected,

  checkConnection: async () => {
    try {
      const state = await NetInfo.fetch();
      currentIsConnected = Boolean(state.isConnected && (state.isInternetReachable === null || state.isInternetReachable));
    } catch {
      // In headless test environments or offline simulators, maintain current status
    }
    return currentIsConnected;
  },

  subscribe: (callback) => {
    listeners.add(callback);
    callback(currentIsConnected);
    return () => listeners.delete(callback);
  },

  /**
   * Asserts online connectivity or informs offline queue behavior
   */
  assertOnline: async (allowOffline = false) => {
    const online = await NetworkService.checkConnection();
    if (!online && !allowOffline) {
      throw new Error('No Internet Connection. MedTrack Cloud requires an active internet connection to load and save ledger records. Please check your network connection.');
    }
    return online;
  },
};

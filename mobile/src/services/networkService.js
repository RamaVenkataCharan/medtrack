import NetInfo from '@react-native-community/netinfo';

let currentIsConnected = true;
const listeners = new Set();

// Initialize NetInfo listener
NetInfo.addEventListener((state) => {
  const isOnline = Boolean(state.isConnected && (state.isInternetReachable === null || state.isInternetReachable));
  currentIsConnected = isOnline;
  listeners.forEach((cb) => {
    try {
      cb(isOnline);
    } catch (err) {
      console.warn('Network listener error:', err);
    }
  });
});

export const NetworkService = {
  isOnline: () => currentIsConnected,

  checkConnection: async () => {
    const state = await NetInfo.fetch();
    currentIsConnected = Boolean(state.isConnected && (state.isInternetReachable === null || state.isInternetReachable));
    return currentIsConnected;
  },

  subscribe: (callback) => {
    listeners.add(callback);
    callback(currentIsConnected);
    return () => listeners.delete(callback);
  },

  assertOnline: async () => {
    const online = await NetworkService.checkConnection();
    if (!online) {
      throw new Error('No Internet Connection. MedTrack Cloud requires an active internet connection to load and save ledger records. Please check your network connection.');
    }
  },
};

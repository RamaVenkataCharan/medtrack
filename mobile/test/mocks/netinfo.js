const listeners = new Set();
let isConnected = true;

export default {
  addEventListener: (cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  fetch: async () => ({
    isConnected,
    isInternetReachable: isConnected,
  }),
  _setConnected: (val) => {
    isConnected = val;
    listeners.forEach((cb) => cb({ isConnected, isInternetReachable: isConnected }));
  },
};

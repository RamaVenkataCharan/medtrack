// mobile/src/utils/deviceId.js
// Generates a persistent device identifier using SecureStore.
// This ID is sent with every sync request so the server can
// attribute changes to a particular device.

import * as SecureStore from 'expo-secure-store';
import { v4 as uuidv4 } from 'uuid';

/**
 * Retrieves the stored device ID or creates a new one if none exists.
 * The ID is stored securely so it survives app reinstalls (when possible).
 * @returns {Promise<string>} The device UUID.
 */
export async function getOrCreateDeviceId() {
  try {
    // Attempt to read an existing ID from SecureStore
    let deviceId = await SecureStore.getItemAsync('device_id');

    if (!deviceId) {
      // No ID yet – generate a v4 UUID and persist it
      deviceId = uuidv4();
      await SecureStore.setItemAsync('device_id', deviceId);
      console.log('🆔 Generated new device ID:', deviceId.substring(0, 8) + '...');
    }

    return deviceId;
  } catch (err) {
    // SecureStore may fail on some devices; fall back to an in‑memory ID
    console.warn('⚠️ SecureStore error, falling back to volatile ID:', err.message);
    return uuidv4();
  }
}

// Example usage (typically in App.js):
// useEffect(() => {
//   getOrCreateDeviceId().then(id => {
//     global.DEVICE_ID = id;
//   });
// }, []);

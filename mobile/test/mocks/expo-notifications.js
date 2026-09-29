export function setNotificationHandler() {}
export async function getPermissionsAsync() {
  return { status: 'granted' };
}
export async function requestPermissionsAsync() {
  return { status: 'granted' };
}
export async function setNotificationChannelAsync() {}
export async function scheduleNotificationAsync() {
  return 'notif-id-123';
}
export async function cancelScheduledNotificationAsync() {}

export default {
  setNotificationHandler,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
};

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Configure notification presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const NotificationService = {
  /**
   * Requests notification permissions from the operating system
   */
  requestPermissions: async () => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          const perm = await window.Notification.requestPermission();
          return perm === 'granted';
        }
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return false;
      }

      // Android 8.0+ notification channel configuration
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('medtrack_reminders', {
          name: 'MedTrack Licence & Expiry Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#1B5E3F',
        });
      }

      return true;
    } catch (err) {
      console.warn('[NotificationService] Error requesting permissions:', err?.message || err);
      return false;
    }
  },

  /**
   * Schedules a notification for a reminder date
   * @param {Object} reminder { id, title, due_date, notes }
   */
  scheduleReminderNotification: async ({ id, title, due_date, notes }) => {
    try {
      if (!due_date) return null;

      const targetDate = new Date(due_date);
      // Default notification trigger time to 9:00 AM on the due date
      targetDate.setHours(9, 0, 0, 0);

      // If the target date is in the past, do not schedule future notification
      if (targetDate.getTime() <= Date.now()) {
        return null;
      }

      const hasPerm = await NotificationService.requestPermissions();
      if (!hasPerm) return null;

      if (Platform.OS === 'web') {
        // Web timeout fallback for active session
        const delay = targetDate.getTime() - Date.now();
        if (delay > 0 && delay < 2147483647) {
          setTimeout(() => {
            if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
              new window.Notification(`MedTrack: ${title}`, {
                body: notes || `Reminder is due today (${due_date}).`,
              });
            }
          }, delay);
        }
        return `web_timeout_${id}`;
      }

      const notifId = await Notifications.scheduleNotificationAsync({
        identifier: `rem_${id}`,
        content: {
          title: `MedTrack: ${title}`,
          body: notes || `Licence/reminder due date: ${due_date}. Please take required action.`,
          sound: true,
          channelId: 'medtrack_reminders',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
        },
      });

      return notifId;
    } catch (err) {
      console.warn('[NotificationService] Failed to schedule reminder notification:', err?.message || err);
      return null;
    }
  },

  /**
   * Cancels a previously scheduled notification
   */
  cancelReminderNotification: async (id) => {
    try {
      if (Platform.OS !== 'web') {
        await Notifications.cancelScheduledNotificationAsync(`rem_${id}`);
      }
    } catch (err) {
      console.warn('[NotificationService] Failed to cancel notification:', err?.message || err);
    }
  },
};

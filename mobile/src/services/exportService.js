import { Platform, Alert } from 'react-native';
import { exportAllData } from '../db/database';

/**
 * Creates a complete JSON backup file and triggers download (Web) or native share sheet (Mobile).
 */
export async function exportKhataBackup() {
  try {
    const data = exportAllData();
    const dateStamp = new Date().toISOString().split('T')[0];
    const fileName = `medtrack_backup_${dateStamp}.json`;
    const jsonString = JSON.stringify(data, null, 2);

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        const total = data.totalCustomers || data.customers?.length || 0;
        const active = data.activeCustomers ?? total;
        const deleted = data.deletedCustomers ?? 0;
        Alert.alert(
          'Backup Exported',
          `Exported ${fileName}\n\nTotal: ${total} customers (${active} active, ${deleted} in Recycle Bin).`
        );
        return { success: true, count: total };
      }
    }

    let FileSystem;
    try {
      FileSystem = require('expo-file-system/legacy');
    } catch {
      FileSystem = require('expo-file-system');
    }
    const Sharing = require('expo-sharing');
    const filePath = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, jsonString, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: 'Export MedTrack Khata Backup',
        UTI: 'public.json',
      });
      const total = data.totalCustomers || data.customers?.length || 0;
      return { success: true, count: total };
    } else {
      const total = data.totalCustomers || data.customers?.length || 0;
      Alert.alert(
        'Backup Created',
        `Backup file written to:\n${filePath}\n(${total} customers included).`
      );
      return { success: true, path: filePath };
    }
  } catch (error) {
    console.error('Failed to export khata backup:', error);
    Alert.alert('Export Failed', 'Could not export backup: ' + (error.message || 'Unknown error'));
    return { success: false, error };
  }
}

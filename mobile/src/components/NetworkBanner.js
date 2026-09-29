import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NetworkService } from '../services/networkService';
import { OfflineSyncService } from '../services/offlineSyncService';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../constants/theme';

export default function NetworkBanner() {
  const [online, setOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'pending' | 'synced'
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const unsubNetwork = NetworkService.subscribe((isOnline) => {
      setOnline(isOnline);
    });

    const unsubSync = OfflineSyncService.subscribe((state) => {
      setSyncStatus(state.status);
      setPendingCount(state.pendingCount || 0);
    });

    return () => {
      unsubNetwork?.();
      unsubSync?.();
    };
  }, []);

  if (online && syncStatus !== 'syncing' && pendingCount === 0) {
    return null;
  }

  // Display syncing banner
  if (syncStatus === 'syncing') {
    return (
      <View style={[styles.container, styles.syncingContainer]}>
        <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 8 }} />
        <Text style={styles.syncingText}>
          Syncing {pendingCount > 0 ? `${pendingCount} ` : ''}records with MedTrack Cloud...
        </Text>
      </View>
    );
  }

  // Display offline banner
  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={16} color="#B45309" style={styles.icon} />
      <Text style={styles.offlineText}>
        {pendingCount > 0
          ? `Offline mode · ${pendingCount} ${pendingCount === 1 ? 'record' : 'records'} saved locally (will sync when online)`
          : "You're offline · Essential records are saved locally"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  syncingContainer: {
    backgroundColor: COLORS.surfaceSubtle,
    borderBottomColor: COLORS.primaryBorder,
  },
  icon: {
    marginRight: 6,
  },
  offlineText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    textAlign: 'center',
  },
  syncingText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
});

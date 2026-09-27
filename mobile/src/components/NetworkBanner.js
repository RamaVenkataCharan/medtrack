import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NetworkService } from '../services/networkService';
import { COLORS, SPACING, FONTS } from '../constants/theme';

export default function NetworkBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetworkService.subscribe((isOnline) => {
      setOnline(isOnline);
    });
    return unsubscribe;
  }, []);

  if (online) return null;

  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={16} color="#B45309" style={styles.icon} />
      <Text style={styles.text}>
        You're offline. Internet connection required to access or save khata data.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEF3C7',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  icon: {
    marginRight: SPACING.xs,
  },
  text: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
    textAlign: 'center',
  },
});

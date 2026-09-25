import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { initDatabase } from './src/db/database';
import { COLORS } from './src/constants/theme';
import { AuthService } from './src/services/authService';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import AddCustomerScreen from './src/screens/AddCustomerScreen';
import CustomerProfileScreen from './src/screens/CustomerProfileScreen';
import AddPurchaseScreen from './src/screens/AddPurchaseScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import RecycleBinScreen from './src/screens/RecycleBinScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    try {
      initDatabase();
      setDbReady(true);
    } catch (err) {
      console.error('Failed to initialize local SQLite database:', err);
    }

    // Check for existing session on launch
    AuthService.getSession()
      .then((currSession) => {
        setSession(currSession);
      })
      .finally(() => {
        setAuthLoading(false);
      });

    // Listen to login/logout/token refresh events
    const subscription = AuthService.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription?.unsubscribe?.();
    };
  }, []);

  if (!dbReady || authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" backgroundColor={COLORS.background} />
      <Stack.Navigator
        initialRouteName={session ? 'Home' : 'Login'}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'slide_from_right',
        }}
      >
        {session ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="AddCustomer" component={AddCustomerScreen} />
            <Stack.Screen name="CustomerProfile" component={CustomerProfileScreen} />
            <Stack.Screen name="AddPurchase" component={AddPurchaseScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="RecycleBin" component={RecycleBinScreen} />
          </>
        ) : (
          <Stack.Screen name="Login">
            {(props) => (
              <LoginScreen
                {...props}
                onLoginSuccess={(user) => setSession({ user })}
              />
            )}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

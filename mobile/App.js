import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, LogBox, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';

// Suppress known harmless deprecation warnings only
LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'SafeAreaView',
]);

import { initDatabase } from './src/db/database';
import { COLORS } from './src/constants/theme';
import { AuthService } from './src/services/authService';

import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import CustomerSearchScreen from './src/screens/CustomerSearchScreen';
import CustomerProfileScreen from './src/screens/CustomerProfileScreen';
import PurchaseDetailsScreen from './src/screens/PurchaseDetailsScreen';
import AddCustomerScreen from './src/screens/AddCustomerScreen';
import AddPurchaseScreen from './src/screens/AddPurchaseScreen';
import PurchaseSuccessScreen from './src/screens/PurchaseSuccessScreen';
import RecycleBinScreen from './src/screens/RecycleBinScreen';
import MedicinesSearchScreen from './src/screens/MedicinesSearchScreen';
import ShopInfoScreen from './src/screens/ShopInfoScreen';
import PharmacistDetailsScreen from './src/screens/PharmacistDetailsScreen';
import RemindersScreen from './src/screens/RemindersScreen';
import MoreScreen from './src/screens/MoreScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(true);

  useEffect(() => {
    Promise.resolve(initDatabase())
      .catch((err) => {
        console.warn('Database layer init notice:', err);
      })
      .finally(() => {
        setDbReady(true);
      });

    // Check onboarding preference
    const checkOnboarding = async () => {
      try {
        if (Platform.OS === 'web') {
          const val = typeof localStorage !== 'undefined' ? localStorage.getItem('medtrack_seen_onboarding') : 'true';
          setHasSeenOnboarding(val === 'true');
        } else {
          const val = await SecureStore.getItemAsync('medtrack_seen_onboarding');
          setHasSeenOnboarding(val === 'true');
        }
      } catch {
        setHasSeenOnboarding(true);
      }
    };
    checkOnboarding();

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

  const markOnboardingDone = async () => {
    setHasSeenOnboarding(true);
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') localStorage.setItem('medtrack_seen_onboarding', 'true');
      } else {
        await SecureStore.setItemAsync('medtrack_seen_onboarding', 'true');
      }
    } catch {}
  };

  if (!dbReady || authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Determine initial route
  let initialRoute = 'Home';
  if (!session) {
    initialRoute = hasSeenOnboarding ? 'Login' : 'Onboarding';
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" backgroundColor={COLORS.background} />
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.background },
            animation: 'slide_from_right',
          }}
        >
          {session ? (
            <>
              {/* Primary Tabs & Core Screens */}
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="CustomerSearch" component={CustomerSearchScreen} />
              <Stack.Screen name="MedicinesSearch" component={MedicinesSearchScreen} />
              <Stack.Screen name="More" component={MoreScreen} />

              {/* Workflows */}
              <Stack.Screen name="CustomerProfile" component={CustomerProfileScreen} />
              <Stack.Screen name="PurchaseDetails" component={PurchaseDetailsScreen} />
              <Stack.Screen name="AddCustomer" component={AddCustomerScreen} />
              <Stack.Screen name="AddPurchase" component={AddPurchaseScreen} />
              <Stack.Screen name="PurchaseSuccess" component={PurchaseSuccessScreen} />

              {/* Secondary Detail Screens */}
              <Stack.Screen name="RecycleBin" component={RecycleBinScreen} />
              <Stack.Screen name="ShopInfo" component={ShopInfoScreen} />
              <Stack.Screen name="PharmacistDetails" component={PharmacistDetailsScreen} />
              <Stack.Screen name="Reminders" component={RemindersScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="Onboarding">
                {(props) => <OnboardingScreen {...props} onFinish={() => props.navigation.replace('Home')} />}
              </Stack.Screen>
            </>
          ) : (
            <>
              {!hasSeenOnboarding && (
                <Stack.Screen name="Onboarding">
                  {(props) => (
                    <OnboardingScreen
                      {...props}
                      onFinish={async () => {
                        await markOnboardingDone();
                        props.navigation.replace('Login');
                      }}
                    />
                  )}
                </Stack.Screen>
              )}
              <Stack.Screen name="Login">
                {(props) => (
                  <LoginScreen
                    {...props}
                    onLoginSuccess={(user) => setSession({ user })}
                  />
                )}
              </Stack.Screen>
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
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

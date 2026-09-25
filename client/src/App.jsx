import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import { ToastProvider } from './components/Toast';
import Home from './pages/Home';
import CustomerProfile from './pages/CustomerProfile';
import DuesReport from './pages/DuesReport';
import RecycleBin from './pages/RecycleBin';
import ShopProfile from './pages/ShopProfile';
import PinLockModal from './components/PinLockModal';
import LoginModal from './components/LoginModal';
import { auth } from './utils/auth';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes auto-lock

export default function App() {
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'profile' | 'dues' | 'recycle_bin' | 'shop_profile'
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const timerRef = useRef(null);

  // Inactivity Auto-Lock
  const resetInactivityTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsLocked(true);
    }, INACTIVITY_TIMEOUT_MS);
  };

  // Auth Initialization & Session Persistence Check
  useEffect(() => {
    auth.getSession()
      .then((currSession) => {
        setSession(currSession);
      })
      .finally(() => {
        setAuthLoading(false);
      });

    const subscription = auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const handleUserActivity = () => {
      if (!isLocked) {
        resetInactivityTimer();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));
    resetInactivityTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
    };
  }, [isLocked]);

  const handleSelectCustomer = (customer) => {
    setSelectedCustomerId(customer.customer_id);
    setCurrentView('profile');
  };

  const handleBackToSearch = () => {
    setSelectedCustomerId(null);
    setCurrentView('home');
  };

  const handleLogout = async () => {
    await auth.signOut();
    setSession(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-indigo-600 selection:text-white">
        {/* Top Khata Header */}
        <Header
          currentView={currentView}
          setCurrentView={setCurrentView}
          onBackToSearch={handleBackToSearch}
          onLock={() => setIsLocked(true)}
          user={session?.user}
          onLogout={handleLogout}
        />

        {/* Main Content View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {currentView === 'home' && (
            <Home
              onSelectCustomer={handleSelectCustomer}
              onOpenDuesReport={() => setCurrentView('dues')}
            />
          )}

          {currentView === 'profile' && selectedCustomerId && (
            <CustomerProfile
              customerId={selectedCustomerId}
              onBackToSearch={handleBackToSearch}
            />
          )}

          {currentView === 'dues' && (
            <DuesReport
              onSelectCustomer={handleSelectCustomer}
            />
          )}

          {currentView === 'recycle_bin' && (
            <RecycleBin
              onBackToSearch={handleBackToSearch}
              onSelectCustomer={handleSelectCustomer}
            />
          )}

          {currentView === 'shop_profile' && (
            <ShopProfile
              onBack={handleBackToSearch}
            />
          )}
        </main>

        {/* Supabase Email OTP Login Modal (when session is null) */}
        {!session && (
          <LoginModal
            isOpen={!session}
            onLoginSuccess={(newSession) => setSession(newSession)}
          />
        )}

        {/* Security PIN Gate Modal */}
        <PinLockModal
          isLocked={isLocked}
          onUnlock={() => {
            setIsLocked(false);
            resetInactivityTimer();
          }}
        />

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-3.5 px-6 text-center text-xs text-slate-400">
          MedTrack Khata Ledger • Medical Shop Customer Dues & Medicine Purchase History
        </footer>
      </div>
    </ToastProvider>
  );
}

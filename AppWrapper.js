import React, { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AppNavigator from './Navigation/AppNavigator';
import PinScreen from './Pages/PinScreen';
import PinStorage from './services/PinStorage';

const AppWrapper = ({ navigationRef }) => {
  const [isPinRequired, setIsPinRequired] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const isFirstCheck = useRef(true);
  const [isCheckingPin, setIsCheckingPin] = useState(true);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    console.log('AppWrapper: Starting initial check');
    // Initial check on app start
    const initializeApp = async () => {
      console.log('AppWrapper: About to check PIN requirement');
      // Wait a bit to ensure app state is properly initialized
      await new Promise(resolve => setTimeout(resolve, 100));
      checkPinRequirement();
    };
    
    initializeApp();

    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log('AppWrapper: App state changed from', appState.current, 'to', nextAppState);
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - check if PIN is required
        console.log('AppWrapper: App became active, checking PIN requirement');
        checkPinRequirement();
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background - record time
        console.log('AppWrapper: App went to background');
        PinStorage.recordBackgroundTime();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  const checkPinRequirement = async () => {
    console.log('AppWrapper: Checking PIN requirement');
    setIsCheckingPin(true);
    try {
      const pinEnabled = await PinStorage.isPinEnabled();
      console.log('PIN Enabled Status:', pinEnabled);
      
      if (!pinEnabled) {
        console.log('PIN is not enabled, showing main app');
        setIsPinRequired(false);
        setInitialCheckDone(true);
        setIsCheckingPin(false);
        return;
      }

      // For the first check (app start), require PIN if enabled, regardless of timeout
      // For subsequent checks (background/foreground), use normal timeout logic
      let pinRequired;
      if (isFirstCheck.current) {
        // First check after app start - require PIN if enabled
        pinRequired = true;
        console.log('AppWrapper: First check after app start, requiring PIN');
        isFirstCheck.current = false;
      } else {
        // Subsequent checks - use normal timeout logic
        pinRequired = await PinStorage.isPinRequired();
        console.log('AppWrapper: Subsequent check, PIN Required Status:', pinRequired);
      }
      
      setIsPinRequired(pinRequired);
      setInitialCheckDone(true);
    } catch (error) {
      console.error('Error checking PIN requirement:', error);
      // Default to requiring PIN on error for security
      setIsPinRequired(true);
      setInitialCheckDone(true);
    } finally {
      setIsCheckingPin(false);
    }
  };

  const handlePinSuccess = async () => {
    await PinStorage.recordUnlockTime();
    setIsPinRequired(false);
  };

  // Don't render anything until initial check is complete
  if (!initialCheckDone) {
    // Show a blank screen until we've completed the initial check
    return null;
  }

  // Check PIN status and show PIN screen if required
  console.log('AppWrapper: Render decision - isPinRequired:', isPinRequired, 'initialCheckDone:', initialCheckDone);
  if (isPinRequired) {
    console.log('AppWrapper: Showing PIN screen');
    return (
      <PinScreen
        navigation={{ navigate: () => {}, goBack: handlePinSuccess }}
        route={{ params: { mode: 'enter', onComplete: handlePinSuccess } }}
      />
    );
  }

  console.log('AppWrapper: Showing main app');
  return <AppNavigator navigationRef={navigationRef} />;
};

export default AppWrapper;
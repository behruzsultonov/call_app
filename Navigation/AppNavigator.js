import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PhoneAuthScreen from '../Pages/PhoneAuthScreen';
import OtpVerifyScreen from '../Pages/OtpVerifyScreen';
import BottomTabs from './BottomTabs';
import CallScreen from '../Pages/CallScreen';
import ChatScreen from '../Pages/ChatScreen';
import LanguageSelectionScreen from '../Pages/LanguageSelectionScreen';
import ThemeSelectionScreen from '../Pages/ThemeSelectionScreen';
import ContactInfoScreen from '../Pages/ContactInfoScreen';
import CallInfoScreen from '../Pages/CallInfoScreen';
import { WebRTCProvider } from '../contexts/WebRTCContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);
  
  useEffect(() => {
    checkAuthState();
  }, []);
  
  const checkAuthState = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const authToken = await AsyncStorage.getItem('authToken');
      
      if (userData && authToken) {
        // User is authenticated, go to main tabs
        setInitialRoute('MainTabs');
      } else {
        // User is not authenticated, go to phone auth
        setInitialRoute('PhoneAuth');
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      // Default to phone auth if there's an error
      setInitialRoute('PhoneAuth');
    }
  };
  
  // Show nothing while determining initial route
  if (initialRoute === null) {
    return null;
  }
  
  return (
    <NavigationContainer>
      <WebRTCProvider>
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
          <Stack.Screen name="PhoneAuth" component={PhoneAuthScreen} />
          <Stack.Screen name="OTP" component={OtpVerifyScreen} />
          <Stack.Screen name="MainTabs" component={BottomTabs} />
          <Stack.Screen name="Call" component={CallScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="ContactInfo" component={ContactInfoScreen} />
          <Stack.Screen name="CallInfo" component={CallInfoScreen} />
          <Stack.Screen name="LanguageSelection" component={LanguageSelectionScreen} />
          <Stack.Screen name="ThemeSelection" component={ThemeSelectionScreen} />
        </Stack.Navigator>
      </WebRTCProvider>
    </NavigationContainer>
  );
}
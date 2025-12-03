import React from 'react';
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

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <WebRTCProvider>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
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
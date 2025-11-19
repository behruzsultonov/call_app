import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PhoneAuthScreen from '../Pages/PhoneAuthScreen';
import OtpVerifyScreen from '../Pages/OtpVerifyScreen';
import BottomTabs from './BottomTabs';
import CallScreen from '../Pages/CallScreen';
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
        </Stack.Navigator>
      </WebRTCProvider>
    </NavigationContainer>
  );
}
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
import SplashScreen from '../Pages/SplashScreen';
import AddContactScreen from '../Pages/AddContactScreen';
import RecordedCallsScreen from '../Pages/RecordedCallsScreen';
import AddGroupScreen from '../Pages/AddGroupScreen';
import GroupInfoScreen from '../Pages/GroupInfoScreen';
import SelectContactsToAddScreen from '../Pages/SelectContactsToAddScreen';
import FavoritesScreen from '../Pages/FavoritesScreen';
import ChannelsScreen from '../Pages/ChannelsScreen';
import ChannelViewScreen from '../Pages/ChannelViewScreen';
import CreatePostScreen from '../Pages/CreatePostScreen';
import MySubscriptionsScreen from '../Pages/MySubscriptionsScreen';
import CreateChannelScreen from '../Pages/CreateChannelScreen';
import { WebRTCProvider } from '../contexts/WebRTCContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthToken } from '../services/Client';

const Stack = createNativeStackNavigator();

export default function AppNavigator({ navigationRef }) {
  return (
    <NavigationContainer ref={navigationRef}>
      <WebRTCProvider>
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="PhoneAuth" component={PhoneAuthScreen} />
          <Stack.Screen name="OTP" component={OtpVerifyScreen} />
          <Stack.Screen name="MainTabs" component={BottomTabs} />
          <Stack.Screen name="Call" component={CallScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="ContactInfo" component={ContactInfoScreen} />
          <Stack.Screen name="CallInfo" component={CallInfoScreen} />
          <Stack.Screen name="LanguageSelection" component={LanguageSelectionScreen} />
          <Stack.Screen name="ThemeSelection" component={ThemeSelectionScreen} />
          <Stack.Screen name="AddContact" component={AddContactScreen} />
          <Stack.Screen name="RecordedCalls" component={RecordedCallsScreen} />
          <Stack.Screen name="AddGroup" component={AddGroupScreen} />
          <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
          <Stack.Screen name="SelectContactsToAdd" component={SelectContactsToAddScreen} />
          <Stack.Screen name="Favorites" component={FavoritesScreen} />
          <Stack.Screen name="Channels" component={ChannelsScreen} />
          <Stack.Screen name="ChannelView" component={ChannelViewScreen} />
          <Stack.Screen name="CreatePost" component={CreatePostScreen} />
          <Stack.Screen name="MySubscriptions" component={MySubscriptionsScreen} />
          <Stack.Screen name="CreateChannel" component={CreateChannelScreen} />
        </Stack.Navigator>
      </WebRTCProvider>
    </NavigationContainer>
  );
}
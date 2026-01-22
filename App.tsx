/**
 * CallApp - Audio Calling Application
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { NavigationContainerRef } from '@react-navigation/native';
import AppNavigator from './Navigation/AppNavigator';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './localization/i18n';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import api from './services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';

function App() {
  
  // Ref to hold the navigation container instance
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  useEffect(() => {
    // Create notification channel on app start
    const createNotificationChannel = async () => {
      // Create a channel
      const channelId = await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        description: 'Used for general notifications',
        vibration: true,
        badge: true,
        importance: 4, // IMPORTANCE_HIGH
      });

      return channelId;
    };

    createNotificationChannel();
    
    // Request permission and get FCM token
    requestUserPermission();
    
    // Listen for FCM token refresh
    const tokenUnsubscribe = messaging().onTokenRefresh(async (token) => {
      console.log('FCM token refreshed:', token);
      await saveFcmTokenToBackend(token);
    });

    // Cleanup subscriptions on unmount
    return () => {
      tokenUnsubscribe();
    };
  }, []);

  // Function to request notification permissions and get FCM token
  const requestUserPermission = async () => {
    try {
      // Request permission for iOS
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Authorization status:', authStatus);
        
        // Get the FCM token
        const fcmToken = await messaging().getToken();
        console.log('FCM Token:', fcmToken);
        
        // Save FCM token to backend if user is authenticated
        await saveFcmTokenToBackend(fcmToken);
      }
    } catch (error) {
      console.log('Error requesting user permission:', error);
    }
  };

  // Function to save FCM token to backend if user is authenticated
  const saveFcmTokenToBackend = async (fcmToken: string) => {
    if (!fcmToken) return;
    
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        await api.updateFcmToken(fcmToken, Platform.OS);
        console.log('FCM token updated successfully');
      }
    } catch (error) {
      console.log('Failed to update FCM token:', error);
    }
  };

  // Handle foreground messages
  async function onMessageReceived(message: any) {
    console.log('Message is', message);
    
    // Generate a unique ID for the notification to prevent overwriting
    const notificationId = message.data?.messageId || Date.now().toString();
    
    // Display notification when app is in foreground
    if (message.data && message.notification) {
      // Use the notification title and body from the message
      await notifee.displayNotification({
        id: notificationId, // Unique ID to prevent overwriting
        title: message.notification.title || 'New Message',
        body: message.notification.body || 'You have a new message',
        data: message.data,
        android: {
          channelId: 'default',
          pressAction: {
            id: 'default',
            launchActivity: 'default',
            mainComponent: 'com.callapp.MainActivity' // Specify main activity for deep linking
          },
          // Prevent notifications from stacking incorrectly
          smallIcon: 'ic_launcher', // Use the app launcher icon as notification icon
          importance: 4, // IMPORTANCE_HIGH
        },
        ios: {
          sound: 'default'
        }
      });
    } else if (message.data) {
      // If only data payload exists, create a notification manually
      const title = message.data.senderName || 'New Message';
      const body = message.data.text || 'You have a new message';
      
      await notifee.displayNotification({
        id: notificationId, // Unique ID to prevent overwriting
        title: title,
        body: body,
        data: message.data,
        android: {
          channelId: 'default',
          pressAction: {
            id: 'default',
            launchActivity: 'default',
            mainComponent: 'com.callapp.MainActivity' // Specify main activity for deep linking
          },
          smallIcon: 'ic_launcher', // Use the app launcher icon as notification icon
          importance: 4, // IMPORTANCE_HIGH
        },
        ios: {
          sound: 'default'
        }
      });
    }
  }

  async function onMessageReceivedBg(message: any) {
    console.log('BG Message is', message);
  }

  messaging().onMessage(onMessageReceived);
  messaging().setBackgroundMessageHandler(onMessageReceivedBg);

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ThemeProvider>
          <AppNavigator navigationRef={navigationRef} />
        </ThemeProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

export default App;
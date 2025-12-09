import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken } from '../services/Client';

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      console.log('SplashScreen: Checking auth state...');
      
      // Reset connections to clear any SSL/TLS session issues
      console.log('SplashScreen: Resetting HTTP/HTTPS connections...');
      api.resetConnections();
      
      // Load user data and auth token from AsyncStorage
      const userData = await AsyncStorage.getItem('userData');
      const authToken = await AsyncStorage.getItem('authToken');
      
      console.log('SplashScreen: Loaded user data:', userData);
      console.log('SplashScreen: Loaded auth token:', authToken);
      
      if (userData && authToken) {
        // User is authenticated
        console.log('SplashScreen: User is authenticated, setting auth token...');
        
        // Set the auth token in the API client
        setAuthToken(authToken);
        
        // Navigate to main tabs immediately (no setTimeout delay)
        console.log('SplashScreen: Navigating to MainTabs');
        navigation.replace('MainTabs');
      } else {
        // User is not authenticated
        console.log('SplashScreen: User not authenticated, navigating to PhoneAuth');
        navigation.replace('PhoneAuth');
      }
    } catch (error) {
      console.error('SplashScreen: Error checking auth state:', error);
      // Default to phone auth if there's an error
      navigation.replace('PhoneAuth');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CallApp</Text>
      <ActivityIndicator size="large" color="#D88A22" />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#D88A22',
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
});
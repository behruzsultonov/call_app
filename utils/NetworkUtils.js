import { Platform, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Check network connectivity
export const checkNetworkStatus = async () => {
  try {
    const state = await NetInfo.fetch();
    console.log('Network Status:', {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      details: state.details
    });
    return state;
  } catch (error) {
    console.error('Error checking network status:', error);
    return null;
  }
};

// Monitor network changes
export const subscribeToNetworkStatus = (callback) => {
  return NetInfo.addEventListener(state => {
    console.log('Network state changed:', {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type
    });
    callback(state);
  });
};

// Test connection to specific URL
export const testUrlConnectivity = async (url, timeout = 10000) => {
  try {
    console.log(`Testing connectivity to: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log(`URL test response status: ${response.status}`);
    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    console.error(`URL test failed for ${url}:`, error.message);
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
};

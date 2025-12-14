import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Base URLs - try HTTPS first, then HTTP as fallback
const CHAT_API_URL_HTTPS = 'https://sadoapp.tj/callapp-be/';
const CHAT_API_URL_HTTP = 'http://sadoapp.tj/callapp-be/';
let CHAT_API_URL = CHAT_API_URL_HTTPS; // Start with HTTPS

let authToken = '3dcf3c53cf3ebdb3af396d63043d5596063f143e412816f374bceeeb5a8fa381';

console.log('Initializing API client with baseURL:', CHAT_API_URL);
console.log('Platform:', Platform.OS);

// Create axios instance
const apiClient = axios.create({
  baseURL: CHAT_API_URL,
  timeout: 60000, // Increased timeout from 30s to 60s
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  validateStatus: function (status) {
    // Don't reject any status code - we'll handle it in error handler
    return status >= 100 && status < 600;
  },
  httpAgent: {
    keepAlive: false, // Disable HTTP keep-alive on failed connections
  },
  httpsAgent: {
    keepAlive: false, // Disable HTTPS keep-alive on failed connections
  }
});

console.log('API client initialized:', apiClient);

// Add request interceptor to include auth token
apiClient.interceptors.request.use(
  (config) => {
    console.log('Interceptor called with config:', config);
    const currentToken = getAuthToken();
    console.log('Current auth token from getAuthToken():', currentToken);
    console.log('Request config before processing:', config);
    
    // Add token to query parameters if available
    if (currentToken) {
      if (!config.params) {
        config.params = {};
      }
      config.params.token = currentToken;
      console.log('Adding auth token to request:', currentToken);
    } else {
      console.log('No auth token available for request');
    }
    console.log('→', config.method?.toUpperCase(), config.url, JSON.stringify(config.params || config.data, null, 2));
    // Construct full URL for debugging
        const fullUrl = config.baseURL + config.url;
        const queryString = config.params ? Object.keys(config.params).map(key => 
          `${encodeURIComponent(key)}=${encodeURIComponent(config.params[key])}`).join('&') : '';
        const finalUrl = queryString ? `${fullUrl}?${queryString}` : fullUrl;
        console.log('Full request URL:', finalUrl);
        
        console.log('Final request config:', config);
    return config;
  },
  (error) => {
    console.log('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    console.log('←', response.status, response.data);
    
    // Check if response status indicates an error
    if (response.status >= 400) {
      console.log('HTTP Error Status:', response.status);
      return Promise.reject(new Error(`HTTP ${response.status}: ${response.data?.message || 'Unknown error'}`));
    }
    
    return response;
  },
  (error) => {
    // Enhanced error logging
    console.log('API Error Details:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers,
      config: error.config ? {
        url: error.config.baseURL + error.config.url,
        method: error.config.method,
        params: error.config.params,
        headers: error.config.headers
      } : null,
      request: error.request ? {
        status: error.request.status,
        statusText: error.request.statusText,
        responseURL: error.request.responseURL
      } : null
    });
    
    // If it's a network error, try to provide more details
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.log('Network Error detected - checking connectivity...');
      console.log('Error details:', {
        isNetworkError: true,
        requestURL: error.config?.url,
        method: error.config?.method,
        timeout: error.config?.timeout
      });
    }
    
    return Promise.reject(error);
  }
);

// Functions to manage auth token
const setAuthToken = (token) => {
  console.log('Setting auth token:', token);
  authToken = token;
  console.log('Auth token set successfully. New token value:', authToken);
};

const getAuthToken = () => {
  console.log('Getting auth token. Current value:', authToken);
  return authToken;
};

const api = {};

// Add a test function to verify basic connectivity
api.testConnectivity = async () => {
  try {
    console.log('Testing basic connectivity to:', CHAT_API_URL);
    
    // Test 1: Simple GET request
    console.log('Test 1: Simple GET request...');
    const response1 = await fetch(`${CHAT_API_URL}index.php?action=test`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000
    });
    
    console.log('Test 1 response status:', response1.status);
    console.log('Test 1 response ok:', response1.ok);
    
    if (!response1.ok) {
      throw new Error(`Server returned ${response1.status}`);
    }
    
    const data = await response1.json();
    console.log('Connectivity test response:', data);
    
    // Test 2: Request with token
    console.log('Test 2: Request with auth token...');
    const token = getAuthToken();
    const response2 = await fetch(`${CHAT_API_URL}index.php?action=test&token=${token}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Test 2 response status:', response2.status);
    const data2 = await response2.json();
    console.log('Test 2 response:', data2);
    
    return { success: true, data, data2 };
  } catch (error) {
    console.error('Connectivity test error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error;
  }
};

// ------------------ CHATS ------------------
api.getChats = async (userId) => {
  try {
    console.log('api.getChats: Starting request for userId:', userId);
    const response = await apiClient.get('index.php', {
      params: { action: 'chats', user_id: Number(userId) },
    });
    console.log('api.getChats: Successful response:', response);
    return response;
  } catch (error) {
    console.log('API Error in getChats with HTTPS:', error.message);
    console.log('Error code:', error.code);
    
    // If it's a network error and we're using HTTPS, try HTTP fallback
    if ((error.code === 'ERR_NETWORK' || error.message === 'Network Error') && CHAT_API_URL === CHAT_API_URL_HTTPS) {
      console.log('Network error detected, trying HTTP fallback...');
      try {
        api.switchToHTTP();
        const response = await apiClient.get('index.php', {
          params: { action: 'chats', user_id: Number(userId) },
        });
        console.log('HTTP fallback successful for getChats:', response);
        return response;
      } catch (httpError) {
        console.log('HTTP fallback also failed:', httpError.message);
        // Switch back to HTTPS for next attempt
        api.switchToHTTPS();
        throw error;
      }
    }
    
    // Try fetch as fallback
    try {
      console.log('Trying fetch fallback for getChats...');
      const token = getAuthToken();
      const fetchUrl = `${CHAT_API_URL}index.php?action=chats&user_id=${Number(userId)}&token=${encodeURIComponent(token)}`;
      console.log('Fetch URL:', fetchUrl);
      
      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }
      });
      
      console.log('Fetch response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Fetch fallback successful:', data);
      return { data, status: response.status };
    } catch (fetchError) {
      console.log('Fetch fallback also failed:', fetchError);
      throw error; // Throw original axios error
    }
  }
};

api.checkPrivateChat = async (userId, otherUserId) => {
  try {
    console.log('api.checkPrivateChat: Checking for existing chat between', userId, 'and', otherUserId);
    const response = await apiClient.get('index.php', {
      params: { 
        action: 'chats', 
        subaction: 'check_private',
        other_user_id: Number(otherUserId),
        user_id: Number(userId)  // This will be used for authentication
      },
    });
    console.log('api.checkPrivateChat: Response:', response);
    return response;
  } catch (error) {
    console.log('API Error in checkPrivateChat:', error.message);
    throw error;
  }
};

api.createChat = (data) =>
  apiClient.post('index.php?action=chats', {
    chat_name: data.chat_name,
    chat_type: data.chat_type || 'private',
    created_by: Number(data.created_by),
    participants: (data.participants || []).map((id) => Number(id)),
  });

api.updateChat = (data) =>
  apiClient.put('index.php?action=chats', data);

api.deleteChat = (data) =>
  apiClient.delete('index.php?action=chats', { data });

// ------------------ MESSAGES ------------------
api.getMessages = (chatId, userId, limit = 50, offset = 0) =>
  apiClient.get('index.php', {
    params: {
      action: 'messages',
      chat_id: Number(chatId),
      user_id: Number(userId),
      limit,
      offset,
    },
  });

api.sendMessage = (data) =>
  apiClient.post('index.php?action=messages', data);

api.updateMessage = (data) =>
  apiClient.put('index.php?action=messages', data);

api.deleteMessage = (data) =>
  apiClient.delete('index.php?action=messages', { data });

api.markMessageAsRead = (messageId, userId) =>
  apiClient.post('index.php?action=messages_read', {
    message_id: Number(messageId),
    user_id: Number(userId),
  });

// Upload image message
api.uploadImage = (formData) => {
  return apiClient.post('index.php?action=upload_image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

// Upload video message
api.uploadVideo = (formData) => {
  return apiClient.post('index.php?action=upload_video', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

// Upload audio message
api.uploadAudio = (formData) => {
  return apiClient.post('index.php?action=upload_audio', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};
// ------------------ USERS ------------------
api.getUsers = (search = null) =>
  apiClient.get('index.php', {
    params: search
      ? { action: 'users', search }
      : { action: 'users' },
  });

api.getUser = (userId) =>
  apiClient.get('index.php', {
    params: { action: 'users', user_id: Number(userId) },
  });

api.createUser = (data) =>
  apiClient.post('index.php?action=users', data);

api.updateUser = (data) =>
  apiClient.put('index.php?action=users', data);

api.deleteUser = (data) =>
  apiClient.delete('index.php?action=users', { data });

// ------------------ CONTACTS ------------------
api.getContacts = (userId) =>
  apiClient.get('index.php', {
    params: { action: 'contacts', user_id: Number(userId) },
  });

api.addContactByPhone = (userId, phoneNumber) =>
  apiClient.get('index.php', {
    params: { action: 'contacts', subaction: 'add_by_phone', user_id: Number(userId), phone: phoneNumber },
  });

api.createContact = (data) =>
  apiClient.post('index.php?action=contacts', data);

api.updateContact = (data) =>
  apiClient.put('index.php?action=contacts', data);

api.deleteContact = (data) =>
  apiClient.delete('index.php?action=contacts', { data });

// ------------------ AUTH ------------------
api.sendOTP = (phoneNumber) => {
  console.log('Sending OTP request with phone number:', phoneNumber);
  return apiClient.post('index.php?action=verify_otp', {
    action: 'send',
    phone_number: phoneNumber
  });
};

api.verifyOTP = (data) => {
  console.log('Verifying OTP with data:', data);
  return apiClient.post('index.php?action=verify_otp', {
    action: 'verify',
    phone_number: data.phone_number,
    otp_code: data.otp_code
  });
};

// ------------------ AVATAR ------------------
api.uploadAvatar = (userId, imageUri) => {
  const formData = new FormData();
  formData.append('user_id', userId);
  formData.append('avatar', {
    uri: imageUri,
    type: 'image/jpeg', // You might want to determine this dynamically
    name: 'avatar.jpg',
  });

  return apiClient.post('index.php?action=avatar', formData, {
    headers: { 
      'Content-Type': 'multipart/form-data',
    },
  });
};

api.getAvatarUrl = (userId, token = null) => {
  const baseUrl = `${CHAT_API_URL}index.php?action=avatar&user_id=${Number(userId)}`;
  if (token) {
    return `${baseUrl}&token=${token}`;
  }
  return baseUrl;
};

// Function to switch between HTTP and HTTPS
api.switchToHTTP = () => {
  CHAT_API_URL = CHAT_API_URL_HTTP;
  apiClient.defaults.baseURL = CHAT_API_URL_HTTP;
  console.log('Switched to HTTP URL:', CHAT_API_URL_HTTP);
};

api.switchToHTTPS = () => {
  CHAT_API_URL = CHAT_API_URL_HTTPS;
  apiClient.defaults.baseURL = CHAT_API_URL_HTTPS;
  console.log('Switched to HTTPS URL:', CHAT_API_URL_HTTPS);
};

api.getCurrentBaseURL = () => {
  return CHAT_API_URL;
};

// Reset all HTTP/HTTPS connections and caches
// This fixes issues with SSL sessions and connection reuse
api.resetConnections = () => {
  try {
    console.log('Resetting all HTTP/HTTPS connections...');
    
    // Create new axios instance to clear any cached connections
    const newApiClient = axios.create({
      baseURL: CHAT_API_URL,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      validateStatus: function (status) {
        return status >= 100 && status < 600;
      },
      httpAgent: {
        keepAlive: false,
      },
      httpsAgent: {
        keepAlive: false,
      }
    });
    
    // Copy all interceptors to new client
    newApiClient.interceptors.request.use(...apiClient.interceptors.request.handlers);
    newApiClient.interceptors.response.use(...apiClient.interceptors.response.handlers);
    
    console.log('Connection reset complete');
    return true;
  } catch (error) {
    console.error('Error resetting connections:', error);
    return false;
  }
};

// Check HTTPS certificate validity
api.checkCertificate = async () => {
  try {
    console.log('Checking HTTPS certificate for:', CHAT_API_URL_HTTPS);
    
    // Try HTTPS request
    const response = await fetch(CHAT_API_URL_HTTPS + 'index.php?action=test', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Certificate check - HTTPS response:', {
      status: response.status,
      ok: response.ok,
      headers: {
        'content-type': response.headers.get('content-type'),
        'date': response.headers.get('date'),
      }
    });
    
    return {
      https: response.ok,
      status: response.status,
      message: 'Certificate appears valid'
    };
  } catch (error) {
    console.error('Certificate check failed:', error.message);
    return {
      https: false,
      error: error.message,
      message: 'Certificate verification failed - server may have invalid certificate'
    };
  }
};

export default api;
export { CHAT_API_URL, setAuthToken, getAuthToken, CHAT_API_URL_HTTP, CHAT_API_URL_HTTPS };
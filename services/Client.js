import axios from 'axios';

// Base URL
const CHAT_API_URL = 'https://sadoapp.tj/callapp-be/';

let authToken = null;

console.log('Initializing API client with baseURL:', CHAT_API_URL);

// Create axios instance
const apiClient = axios.create({
  baseURL: CHAT_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
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
    console.log('Testing basic connectivity...');
    const response = await fetch(`${CHAT_API_URL}index.php?action=test`);
    const data = await response.json();
    console.log('Connectivity test response:', data);
    return data;
  } catch (error) {
    console.log('Connectivity test error:', error);
    throw error;
  }
};

// ------------------ CHATS ------------------
api.getChats = async (userId) => {
  try {
    const response = await apiClient.get('index.php', {
      params: { action: 'chats', user_id: Number(userId) },
    });
    return response;
  } catch (error) {
    console.log('API Error in getChats:', error);
    // Try fetch as fallback
    try {
      console.log('Trying fetch fallback...');
      const token = getAuthToken();
      const response = await fetch(`${CHAT_API_URL}index.php?action=chats&user_id=${Number(userId)}&token=${encodeURIComponent(token)}`);
      const data = await response.json();
      return { data, status: response.status };
    } catch (fetchError) {
      console.log('Fetch fallback also failed:', fetchError);
      throw error;
    }
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

api.getAvatarUrl = (userId) =>
  `${CHAT_API_URL}index.php?action=avatar&user_id=${Number(userId)}`;

export default api;
export { CHAT_API_URL, setAuthToken, getAuthToken };
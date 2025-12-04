import axios from 'axios';

// Base URL
const CHAT_API_URL = 'https://sadoapp.tj/callapp-be/';

const apiClient = axios.create({
  baseURL: CHAT_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Debug Interceptors (можешь отключить если не надо)
apiClient.interceptors.request.use(
  (config) => {
    console.log('→', config.method?.toUpperCase(), config.url, config.params || config.data);
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => {
    console.log('←', response.status, response.data);
    return response;
  },
  (error) => {
    console.log('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

const api = {};

// ------------------ CHATS ------------------
api.getChats = (userId) =>
  apiClient.get('index.php', {
    params: { action: 'chats', user_id: Number(userId) },
  });

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
export { CHAT_API_URL };
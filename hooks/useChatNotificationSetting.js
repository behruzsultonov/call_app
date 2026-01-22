// Hook for managing chat notification settings
import { useState, useEffect } from 'react';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useChatNotificationSetting = (chatId) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  // Load user ID
  useEffect(() => {
    const loadUserId = async () => {
      try {
        const userDataString = await AsyncStorage.getItem('userData');
        if (userDataString) {
          const user = JSON.parse(userDataString);
          setUserId(user.id);
        }
      } catch (error) {
        console.error('Error loading user ID:', error);
      }
    };
    
    loadUserId();
  }, []);

  // Load current notification setting
  useEffect(() => {
    if (!userId || !chatId) return;
    
    const loadSetting = async () => {
      try {
        setLoading(true);
        const response = await api.getChatNotificationSetting(userId, chatId);
        
        if (response.data.success && response.data.data) {
          setIsEnabled(response.data.data.notifications_enabled);
        }
      } catch (error) {
        console.error('Error loading chat notification setting:', error);
        // Default to enabled if there's an error
        setIsEnabled(true);
      } finally {
        setLoading(false);
      }
    };
    
    loadSetting();
  }, [userId, chatId]);

  // Toggle notification setting
  const toggleNotification = async () => {
    if (!userId || !chatId) return isEnabled;
    
    try {
      setLoading(true);
      const newValue = !isEnabled;
      
      const response = await api.setChatNotificationSetting({
        user_id: userId,
        chat_id: chatId,
        notifications_enabled: newValue
      });
      
      if (response.data.success) {
        setIsEnabled(newValue);
        return newValue;
      } else {
        console.error('Failed to update notification setting:', response.data.message);
        return isEnabled; // Return current value if failed
      }
    } catch (error) {
      console.error('Error toggling chat notification setting:', error);
      return isEnabled; // Return current value if failed
    } finally {
      setLoading(false);
    }
  };

  return {
    isEnabled,
    loading,
    toggleNotification
  };
};

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Header from '../components/Header';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ChatsScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  
  useEffect(() => {
    loadUserData();
  }, []);
  
  useEffect(() => {
    if (userId) {
      loadChats();
    }
  }, [userId]);
  
  const loadUserData = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      const authToken = await AsyncStorage.getItem('authToken');
      
      console.log('ChatsScreen: Loaded user data from AsyncStorage:', userDataString);
      console.log('ChatsScreen: Loaded auth token from AsyncStorage:', authToken);
      
      if (userDataString && authToken) {
        const user = JSON.parse(userDataString);
        console.log('ChatsScreen: Parsed user data:', user);
        setUserId(user.id);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };
  
  const loadChats = async () => {
    if (!userId) {
      console.log('ChatsScreen: No user ID, skipping loadChats');
      return;
    }
    
    console.log('Loading chats for user ID:', userId);
    try {
      setLoading(true);
      console.log('ChatsScreen: Making API call to get chats for user ID:', userId);
      
      const response = await api.getChats(userId);
      
      console.log('ChatsScreen: Received response from getChats:', response);
      
      if (response.data.success) {
        // Transform chats to match the expected format
        const formattedChats = (response.data.data || []).map(chat => ({
          id: chat.id,
          name: chat.chat_type === 'private' && chat.other_participant_name 
            ? chat.other_participant_name 
            : chat.chat_name || 'Unknown',
          message: chat.last_message || '',
          time: chat.last_message_time ? 
            new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
            '',
          unread: chat.unread_count || 0,
          isPrivate: chat.chat_type === 'private',
          otherParticipantId: chat.other_participant_id
        }));
        
        setChats(formattedChats);
      } else {
        console.log('Failed to load chats:', response.data.message);
        setChats([]);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
        config: error.config,
        request: error.request
      });
      setChats([]);
    } finally {
      setLoading(false);
    }
  };
  
  const createNewChat = async (participantId) => {
    if (!userId) return;
    
    try {
      const chatData = {
        chat_name: `Chat ${Date.now()}`,
        chat_type: 'private',
        created_by: userId,
        participants: [userId, participantId]
      };
      
      const response = await api.createChat(chatData);
      
      if (response.data.success) {
        // Reload chats after creating a new one
        loadChats();
        
        // Navigate to the new chat
        const createdChat = response.data.data;
        navigation.navigate('Chat', { 
          chat: { 
            id: createdChat.id, 
            name: createdChat.chat_type === 'private' && createdChat.other_participant_name 
              ? createdChat.other_participant_name 
              : createdChat.chat_name,
            isPrivate: createdChat.chat_type === 'private',
            otherParticipantId: createdChat.other_participant_id
          }
        });
      } else {
        Alert.alert(t('error'), response.data.message || t('failedToCreateChat'));
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      Alert.alert(t('error'), t('failedToCreateChat'));
    }
  };
  
  const handleCreateChat = () => {
    // For now, we'll navigate to contacts screen to select a contact
    // In a real implementation, you would show a contact picker
    navigation.navigate('Contacts');
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.chatItem,
        { 
          borderBottomColor: theme.border,
          backgroundColor: theme.cardBackground
        }
      ]}
      onPress={() => navigation.navigate('Chat', { 
        chat: { 
          id: item.id, 
          name: item.name,
          // Pass additional data for private chats
          isPrivate: item.isPrivate,
          otherParticipantId: item.otherParticipantId
        }
      })}
    >
      <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
        <Text style={[styles.avatarText, { color: theme.buttonText }]}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.chatInfo}>
        <Text style={[styles.chatName, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.chatMessage, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.message}
        </Text>
      </View>
      <View style={styles.chatMeta}>
        <Text style={[styles.chatTime, { color: theme.textSecondary }]}>{item.time}</Text>
        {item.unread > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
            <Text style={[styles.unreadText, { color: theme.buttonText }]}>{item.unread}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title={t('chats')} showSearch={true} />
      
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderChatItem}
        contentContainerStyle={styles.chatList}
        onRefresh={loadChats}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {t('noChatsYet')}
            </Text>
          </View>
        }
      />
      
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={handleCreateChat}
      >
        <Icon name="chat" size={24} color={theme.buttonText} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  chatList: {
    paddingVertical: 8,
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#D88A22',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  chatMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  chatMeta: {
    alignItems: 'flex-end',
  },
  chatTime: {
    fontSize: 12,
    color: '#999',
  },
  unreadBadge: {
    backgroundColor: '#D88A22',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D88A22',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});
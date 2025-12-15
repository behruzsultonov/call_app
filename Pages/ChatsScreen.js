import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  AppState
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
  const appState = useRef(AppState.currentState);
  
  useEffect(() => {
    loadUserData();
  }, []);
  
  // Simplified polling implementation for real-time updates
  useEffect(() => {
    const loadChats = () => {
      if (userId) {
        loadChatsData();
      }
    };

    const refreshChats = () => {
      if (userId) {
        loadChatsData();
      }
    };

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        loadChats();
      }
      appState.current = nextAppState;
    });

    const intervalId = setInterval(() => {
      refreshChats();
    }, 5000);

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
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
  
  const loadChatsData = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const response = await api.getChats(userId);
      
      if (response.data.success) {
        // Transform chats to match the expected format
        const formattedChats = (response.data.data || []).map(chat => {
          // Translate message types
          let displayMessage = chat.last_message || '';
          if (displayMessage === 'Image') {
            displayMessage = t('image');
          } else if (displayMessage === 'Video') {
            displayMessage = t('video');
          } else if (displayMessage === 'Voice Message') {
            displayMessage = t('voiceMessage');
          }
          
          return {
            id: chat.id,
            name: chat.chat_type === 'private' && chat.other_participant_name 
              ? chat.other_participant_name 
              : chat.chat_name || 'Unknown',
            message: displayMessage,
            time: chat.last_message_time ? 
              new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
              '',
            unread: chat.unread_count || 0,
            isPrivate: chat.chat_type === 'private',
            otherParticipantId: chat.other_participant_id
          };
        });
        
        setChats(formattedChats);
      } else {
        console.log('Failed to load chats:', response.data.message);
        setChats([]);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
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
        loadChatsData();
        
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
      onLongPress={() => handleLongPressChat(item)}
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

  const handleLongPressChat = (chat) => {
    Alert.alert(
      t('deleteChat'),
      t('deleteChatConfirmation'),
      [
        {
          text: t('cancel'),
          style: 'cancel'
        },
        {
          text: t('deleteForMe'),
          onPress: () => deleteChat(chat.id, false)
        },
        {
          text: t('deleteForEveryone'),
          onPress: () => deleteChat(chat.id, true)
        }
      ],
      { cancelable: true }
    );
  };

  const deleteChat = async (chatId, deleteForEveryone = false) => {
    if (!userId) return;
    
    try {
      const response = await api.deleteChat({
        chat_id: chatId,
        user_id: userId,
        delete_for_everyone: deleteForEveryone
      });
      
      if (response.data.success) {
        // Remove the chat from the list
        setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
        console.log('Chat deleted successfully');
      } else {
        console.log('Failed to delete chat:', response.data.message);
        Alert.alert(t('error'), response.data.message || t('failedToDeleteChat'));
      }
    } catch (error) {
      console.log('Error deleting chat:', error);
      Alert.alert(t('error'), t('failedToDeleteChat'));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title={t('chats')} showSearch={true} />
      
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderChatItem}
        contentContainerStyle={styles.chatList}
        onRefresh={loadChatsData}
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

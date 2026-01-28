import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  AppState,
  TextInput,
  BackHandler,
  Animated
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Header from '../components/Header';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';

export default function ChatsScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const [chats, setChats] = useState([]);
  const [filteredChats, setFilteredChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [manualRefresh, setManualRefresh] = useState(false); // New state to track manual refresh
  const [userId, setUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const appState = useRef(AppState.currentState);
  
  useEffect(() => {
    loadUserData();
  }, []);
  
  useEffect(() => {
    if (userId) {
      loadChatsData();
    }
  }, [userId]);

  // Notification handling useEffect
  useEffect(() => {
    // Set up notification handlers when component mounts
    setupNotificationHandlers();
    
    // Cleanup function
    return () => {
      // Any cleanup needed for notification handlers
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const backAction = () => {
        return true;
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction,
      );

      return () => backHandler.remove();
    }, []),
  );
  
  // Simplified polling implementation for real-time updates
  useEffect(() => {
    const loadChats = () => {
      if (userId && !searchQuery) {
        loadChatsData(false); // Pass false to indicate this is not a manual refresh
      }
    };

    const refreshChats = () => {
      if (userId && !searchQuery) {
        loadChatsData(false); // Pass false to indicate this is not a manual refresh
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
      if (subscription && subscription.remove) {
        subscription.remove();
      }
      clearInterval(intervalId);
    };
  }, [userId, searchQuery]);
  
  useEffect(() => {
    // Animate FAB menu when it opens/closes
    Animated.parallel([
      Animated.timing(rotateAnim, {
        toValue: showFabMenu ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: showFabMenu ? 1.1 : 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      })
    ]).start();
  }, [showFabMenu]);

  const loadUserData = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      const authToken = await AsyncStorage.getItem('authToken');
      
      if (userDataString && authToken) {
        const user = JSON.parse(userDataString);
        setUserId(user.id);
      } else {
        console.log('No user data or auth token found');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };
  
  const loadChatsData = async (isManualRefresh = false) => {
    if (!userId) {
      return;
    }
    
    try {
      // Only set loading state for manual refreshes
      if (isManualRefresh) {
        setLoading(true);
        setManualRefresh(true);
      }
      
      // Load regular chats
      const response = await api.getChats(userId);
      
      // Load subscribed channels
      let channelsData = [];
      try {
        const channelsResponse = await api.getMySubscribedChannels();
        
        if (channelsResponse.data.success) {
          channelsData = channelsResponse.data.data || [];
        } else {
          console.log('[CHANNELS] API returned failure:', channelsResponse.data.message);
        }
      } catch (channelError) {
        console.log('[CHANNELS] Error loading channels:', channelError.message);
        console.log('[CHANNELS] Error details:', channelError);
        // Continue without channels if there's an error
      }
      
      if (response.data.success) {
        // Transform chats to match the expected format
        const rawChats = response.data.data || [];
        
        const formattedChats = rawChats.map(chat => {
          const formattedChat = {
            id: chat.id,
            name: chat.chat_type === 'private' && chat.other_participant_name 
              ? chat.other_participant_name 
              : chat.chat_name,
            message: chat.last_message || '',
            time: chat.last_message_time ? 
              new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
              '',
            unread: chat.unread_count || 0,
            isPrivate: chat.chat_type === 'private',
            otherParticipantId: chat.other_participant_id,
            memberCount: chat.member_count || 0,  // Add member count for group chats
            type: 'chat'  // Add type to distinguish from channels
          };
          return formattedChat;
        });
        
        // Transform channels to match the chat format
        const formattedChannels = channelsData.map(channel => {
          // Get last post date for time display
          const lastPostTime = channel.last_post_date ? 
            new Date(channel.last_post_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
            '';
          
          // Check if current user is the channel owner
          const isOwner = userId && channel.owner_id && parseInt(userId) === parseInt(channel.owner_id);
          
          const formattedChannel = {
            id: `channel_${channel.id}`,  // Prefix to avoid ID conflicts
            name: channel.title,
            message: channel.last_post_text || `@${channel.username}`,  // Show last post text or username as message
            time: lastPostTime,
            unread: 0,  // Channels don't have unread count
            isPrivate: false,
            channelInfo: {
              id: channel.id,
              username: channel.username,
              subscriberCount: channel.subscriber_count,
              ownerId: channel.owner_id  // Add owner_id for ownership check
            },
            isOwner: isOwner,  // Add ownership flag directly
            type: 'channel'  // Add type to distinguish from chats
          };
          
          return formattedChannel;
        });
        
        // Combine chats and channels
        const allItems = [...formattedChats, ...formattedChannels];
        
        // Log channel items specifically
        const channelItems = allItems.filter(item => item.type === 'channel');
        
        setChats(allItems);
        
        // Apply search filter only if there's an active search query (non-empty)
        if (searchQuery && searchQuery.trim() !== '') {
          applySearchFilter(searchQuery, allItems);
        } else {
          // When there's no search query, show all chats and channels
          setFilteredChats(allItems);
        }
      } else {
        console.log('Failed to load chats:', response.data.message);
        // Only update the lists if we're not currently searching
        if (!searchQuery || searchQuery.trim() === '') {
          setChats([]);
          setFilteredChats([]);
        }
      }
    } catch (error) {
      console.error('Error loading chats:', error);
      // Only update the lists if we're not currently searching
      if (!searchQuery || searchQuery.trim() === '') {
        setChats([]);
        setFilteredChats([]);
      }
    } finally {
      // Only unset loading state for manual refreshes
      if (isManualRefresh) {
        setLoading(false);
        setManualRefresh(false);
      }
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
            otherParticipantId: createdChat.other_participant_id,
            memberCount: createdChat.member_count || (createdChat.chat_type === 'private' ? 2 : 0)
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
    setShowFabMenu(false);
  };
  
  const handleCreateGroup = () => {
    // Navigate to the AddGroup screen to create a group
    navigation.navigate('AddGroup');
    setShowFabMenu(false);
  };
  
  const handleCreateChannel = () => {
    // Navigate to the CreateChannel screen to create a channel
    navigation.navigate('CreateChannel');
    setShowFabMenu(false);
  };
  
  const toggleFabMenu = () => {
    setShowFabMenu(!showFabMenu);
  };
  
  const handleSearch = async (query) => {
    
    if (query.trim() === '') {
      // If search query is empty, clear the search and show all chats
      setSearchQuery('');
      setFilteredChats(chats);
      setIsSearching(false);
      return;
    }
    
    setSearchQuery(query);
    
    setIsSearching(true);
    
    try {
      // Search in regular chats
      const chatResponse = await api.searchChats(userId, query);
      let formattedChats = [];
      
      if (chatResponse.data.success) {
        // Transform search results to match the expected format
        formattedChats = (chatResponse.data.data || []).map(chat => {
          return {
            id: chat.id,
            name: chat.chat_type === 'private' && chat.other_participant_name 
              ? chat.other_participant_name 
              : chat.chat_name,
            message: chat.last_message || '',
            time: chat.last_message_time ? 
              new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
              '',
            unread: chat.unread_count || 0,
            isPrivate: chat.chat_type === 'private',
            otherParticipantId: chat.other_participant_id,
            memberCount: chat.member_count || 0,  // Add member count for group chats
            type: 'chat'  // Add type to distinguish from channels
          };
        });
      }
      
      // Search in channels
      let formattedChannels = [];
      try {
        const channelResponse = await api.searchChannels(query);
        
        if (channelResponse.data.success) {
          formattedChannels = (channelResponse.data.data || []).map(channel => {
            // Get last post date for time display
            const lastPostTime = channel.last_post_date ? 
              new Date(channel.last_post_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
              '';
            
            // Check if current user is the channel owner
            const isOwner = userId && channel.owner_id && parseInt(userId) === parseInt(channel.owner_id);
            
            return {
              id: `channel_${channel.id}`,  // Prefix to avoid ID conflicts
              name: channel.title,
              message: `@${channel.username}`,  // Show username/slug instead of last post text
              time: lastPostTime,
              unread: 0,  // Channels don't have unread count
              isPrivate: false,
              channelInfo: {
                id: channel.id,
                username: channel.username,
                subscriberCount: channel.subscriber_count,
                ownerId: channel.owner_id  // Add owner_id for ownership check
              },
              isOwner: isOwner,  // Add ownership flag directly
              type: 'channel'  // Add type to distinguish from chats
            };
          });
        }
      } catch (channelError) {
        console.log('Error searching channels:', channelError.message);
        // Continue without channels if there's an error
      }
      
      // Combine chats and channels
      const allResults = [...formattedChats, ...formattedChannels];
      
      setFilteredChats(allResults);
    } catch (error) {
      console.error('Error searching chats and channels:', error);
      setFilteredChats([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  const applySearchFilter = (query, chatsList) => {
    if (!query.trim()) {
      setFilteredChats(chatsList);
      return;
    }
    
    const lowerQuery = query.toLowerCase();
    const filtered = chatsList.filter(chat =>
      (chat.name || '').toLowerCase().includes(lowerQuery) ||
      (chat.message || '').toLowerCase().includes(lowerQuery) ||
      // Add search by channel username for channels
      (chat.type === 'channel' && chat.channelInfo && chat.channelInfo.username && 
       chat.channelInfo.username.toLowerCase().includes(lowerQuery))
    );
    
    setFilteredChats(filtered);
  };

  const FabMenu = () => {
    const rotateInterpolate = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '45deg']
    });

    return (
      <View style={styles.fabContainer}>
        {/* Menu items appear above the main FAB */}
        {showFabMenu && (
          <View style={styles.fabMenu}>
            <TouchableOpacity 
              style={[styles.fabMenuItem, { backgroundColor: theme.primary }]}
              onPress={handleCreateChannel}
            >
              <Icon name="rss-feed" size={20} color={theme.buttonText} />
            </TouchableOpacity>
            <View style={styles.menuSpacing} />
            <TouchableOpacity 
              style={[styles.fabMenuItem, { backgroundColor: theme.primary }]}
              onPress={handleCreateGroup}
            >
              <Icon name="group" size={20} color={theme.buttonText} />
            </TouchableOpacity>
            <View style={styles.menuSpacing} />
            <TouchableOpacity 
              style={[styles.fabMenuItem, { backgroundColor: theme.primary }]}
              onPress={handleCreateChat}
            >
              <Icon name="chat" size={20} color={theme.buttonText} />
            </TouchableOpacity>
          </View>
        )}
        
        {/* Main FAB with animated rotation */}
        <Animated.View style={{ transform: [{ rotate: rotateInterpolate }, { scale: scaleAnim }] }}>
          <TouchableOpacity 
            style={[styles.fab, { backgroundColor: theme.primary }]}
            onPress={toggleFabMenu}
          >
            <Icon name="add" size={24} color={theme.buttonText} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  const renderChatItem = ({ item }) => {    
    return (
    <TouchableOpacity 
      style={[
        styles.chatItem,
        { 
          borderBottomColor: theme.border,
          backgroundColor: theme.cardBackground
        }
      ]}
      onPress={() => {
        if (item.type === 'channel') {
          // Navigate to channel view
          navigation.navigate('ChannelView', { 
            channel: {
              id: item.channelInfo.id,
              title: item.name,
              username: item.channelInfo.username,
              owner_id: item.channelInfo.ownerId,  // Add owner_id for consistency
              subscriber_count: item.channelInfo.subscriberCount,
              last_post_text: item.message,  // Add last post text
              is_owner: item.isOwner,  // Pass the pre-calculated ownership flag
              is_subscribed: true
            }
          });
        } else {
          // Navigate to regular chat
          navigation.navigate('Chat', { 
            chat: { 
              id: item.id, 
              name: item.name,
              // Pass additional data for private chats
              isPrivate: item.isPrivate,
              otherParticipantId: item.otherParticipantId,
              memberCount: item.memberCount || 0  // Pass member count for group chats
            }
          });
        }
      }}
      onLongPress={() => {
        if (item.type !== 'channel') {
          handleLongPressChat(item);
        }
        // No long press action for channels
      }}
    >
      <View style={[styles.avatar, { 
        backgroundColor: item.type === 'channel' ? '#34C759' : theme.primary 
      }]}>
        <Text style={[styles.avatarText, { color: theme.buttonText }]}>{item.name ? item.name.charAt(0) : '?'}</Text>
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
  };

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
      } else {
        Alert.alert(t('error'), response.data.message || t('failedToDeleteChat'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('failedToDeleteChat'));
    }
  };

  // Notification handling functions
  const setupNotificationHandlers = async () => {
    // Handle initial notification when app is launched from a notification (app was killed)
    const initialNotification = await messaging().getInitialNotification();
    if (initialNotification) {
      handleNotificationNavigation(initialNotification.data);
    }
    
    // Handle notification when app is in background and user taps on it
    messaging().onNotificationOpenedApp(async (remoteMessage) => {
      if (remoteMessage) {
        handleNotificationNavigation(remoteMessage.data);
      }
    });
    
    // Handle notification when app is in foreground
    notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS) {
        const notificationData = detail.notification?.data;
        if (notificationData) {
          handleNotificationNavigation(notificationData);
        }
      }
    });
  };

  const handleNotificationNavigation = (notificationData) => {
    if (notificationData) {
      const { chatId, senderId, senderName } = notificationData;
      
      if (chatId) {
        // Convert to numbers if they are strings
        const chatIdNum = typeof chatId === 'string' ? parseInt(chatId) : chatId;
        const senderIdNum = typeof senderId === 'string' ? parseInt(senderId) : senderId;
        
        // Navigate to the chat screen with proper chat object structure
        // Use the chat type from notification data to determine if it's a group or private chat
        const isPrivateChat = notificationData.chatType === 'private';
        
        navigation.navigate('Chat', {
          chat: {
            id: chatIdNum,
            name: senderName || (isPrivateChat ? 'Unknown Contact' : 'Unknown Group'),
            isPrivate: isPrivateChat,
            otherParticipantId: isPrivateChat ? senderIdNum : undefined,
            memberCount: isPrivateChat ? 2 : 0 // For private chats, member count is usually 2
          }
        });
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header 
        title={t('chats')} 
        showSearch={true} 
        searchVisible={showSearch}
        onSearchPress={setShowSearch}
        searchValue={searchQuery}
        onSearchChange={handleSearch}
        onBack={() => navigation.goBack()}
      />
      
      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderChatItem}
        contentContainerStyle={styles.chatList}
        onRefresh={() => loadChatsData(true)} // Pass true to indicate manual refresh
        refreshing={manualRefresh} // Use manualRefresh instead of loading
        ListEmptyComponent={() => {
          const channelCount = chats.filter(item => item.type === 'channel').length;
          const chatCount = chats.filter(item => item.type === 'chat').length;
          return (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {t('noChatsYet')}
            </Text>
          </View>
          );
        }}
      />
      
      <FabMenu />
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
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
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D88A22',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabMenu: {
    alignItems: 'center',
    marginBottom: 10,
  },
  fabMenuItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  menuSpacing: {
    height: 10,
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
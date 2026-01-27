import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AudioWaveform from '../components/AudioWaveform'; // Import the audio waveform component
import Header from '../components/Header'; // Import Header component

export default function FavoritesScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState(null);
  const listRef = useRef(null);

  // Audio playback states
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [audioProgress, setAudioProgress] = useState({});

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (userId) {
      loadFavorites();
    }
  }, [userId]);

  useEffect(() => {
    // Scroll to bottom when favorites list changes (like in ChatScreen)
    if (favorites.length > 0) {
      setTimeout(() => scrollToBottom(true), 50);
    }
  }, [favorites.length]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (userId) {
        loadFavorites();
      }
    });

    return unsubscribe;
  }, [navigation, userId]);

  const loadUserData = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      if (userDataString) {
        const user = JSON.parse(userDataString);
        setUserId(user.id);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadFavorites = async (isRefreshing = false) => {
    if (!userId) return;

    try {
      if (!isRefreshing) setLoading(true);

      const response = await api.getFavorites(userId);

      if (response.data.success) {
        // Transform messages to match the expected format
        const formattedFavorites = (response.data.data || []).map(fav => {
          const message = fav;
          return {
            ...message,
            id: parseInt(message.id),
            text: message.message_text || '',
            time: message.sent_at ? new Date(message.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00',
            isMe: parseInt(message.sender_id) === parseInt(userId),
            status: message.status || 'sent',
            messageType: message.message_type || 'text',
            isFavorited: true,
            // Handle audio messages
            audioUrl: message.file_url && message.message_type === 'audio'
              ? `http://sadoapp.tj/callapp-be/${message.file_url}`
              : null,
            // Handle image messages
            imageUrl: message.file_url && message.message_type === 'image'
              ? `http://sadoapp.tj/callapp-be/${message.file_url}`
              : null,
            // Handle video messages
            videoUrl: message.file_url && message.message_type === 'video'
              ? `https://sadoapp.tj/callapp-be/${message.file_url}`
              : null,
            // Handle deleted messages
            isDeleted: message.is_deleted_for_everyone === '1' ||
              message.is_deleted_for_everyone === 1 ||
              message.is_deleted_for_me === '1' ||
              message.is_deleted_for_me === 1,
            deletedForEveryone: message.is_deleted_for_everyone === '1' || message.is_deleted_for_everyone === 1
          };
        });

        // Sort by sent_at timestamp to show newest at the end (like in chat)
        formattedFavorites.sort((a, b) => {
          const dateA = new Date(a.sent_at || 0);
          const dateB = new Date(b.sent_at || 0);
          return dateA - dateB;
        });

        setFavorites(formattedFavorites);
      } else {
        console.log('Failed to load favorites:', response.data.message);
        setFavorites([]);
      }
    } catch (error) {
      console.log('Error loading favorites:', error);
      setFavorites([]);
      Alert.alert(t('error'), t('failedToLoadFavorites'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFavorites(true);
  };

  const toggleFavorite = async (messageId, isCurrentlyFavorited) => {
    if (!userId) return;

    try {
      let response;
      if (isCurrentlyFavorited) {
        // Unfavorite the message
        response = await api.unfavoriteMessage({
          message_id: messageId,
          user_id: userId
        });
      } else {
        // Favorite the message
        response = await api.favoriteMessage({
          message_id: messageId,
          user_id: userId
        });
      }

      if (response.data.success) {
        // Reload the favorites list to reflect the change
        loadFavorites();

        Alert.alert(
          t('success'),
          isCurrentlyFavorited
            ? t('messageRemovedFromFavorites')
            : t('messageAddedToFavorites')
        );
      } else {
        Alert.alert(t('error'), response.data.message || t('failedToUpdateFavorite'));
      }
    } catch (error) {
      console.log('Error updating favorite:', error);
      Alert.alert(t('error'), t('failedToUpdateFavorite'));
    }
  };

  const openChatWithMessage = (message) => {
    // Navigate to the chat that contains this message
    // We need to get the chat details first
    navigation.navigate('Chats'); // For now, navigate to chats screen
  };

  const openContactInfo = (message) => {
    // Navigate to contact info screen with the sender's information
    navigation.navigate('ContactInfo', {
      contactUserId: message.target_user_id,  // Use the target_user_id from favorites
    });
  };

  // Additional function to handle audio playback (this would connect to a real audio player)
  const playAudioMessage = async (audioUrl, messageId) => {
    try {
      // This is where we would integrate with a real audio player
      // For now, just simulate the play/pause behavior
      if (playingAudioId === messageId) {
        setPlayingAudioId(null);
      } else {
        setPlayingAudioId(messageId);
      }
    } catch (error) {
      console.log('Error playing audio:', error);
      Alert.alert(t('error'), t('failedToPlayAudio'));
    }
  };

  // Cleanup audio when component unmounts
  useEffect(() => {
    return () => {
      // In a real implementation, we would cleanup audio resources here
      // For now, we'll just clear any intervals if we had them
    };
  }, []);

  const scrollToBottom = (animated = false) => {
    requestAnimationFrame(() => {
      if (listRef.current && favorites.length > 0) {
        listRef.current.scrollToIndex({
          index: favorites.length - 1,
          animated,
          viewPosition: 1, // bottom
        });
      }
    });
  };

  const renderFavorite = ({ item }) => {
    // Handle deleted messages
    if (item.isDeleted) {
      return (
        <View style={styles.favoriteItem}>
          <View style={styles.avatarPlaceholder} />
          <View
            style={[
              styles.messageContainer,
              item.isMe ? styles.myMessage : styles.otherMessage,
              {
                backgroundColor: item.isMe ? theme.primary : theme.cardBackground,
                opacity: 0.5,
              }
            ]}
          >
            <Text style={[styles.messageText, { color: item.isMe ? theme.buttonText : theme.text, fontStyle: 'italic' }]}>
              {item.deletedForEveryone ? t('messageDeletedForEveryone') : t('messageDeletedForMe')}
            </Text>
            <View style={styles.messageInfo}>
              <Text style={[styles.time, { color: item.isMe ? '#ffffffaa' : '#888' }]}>{item.time}</Text>
            </View>
          </View>
        </View>
      );
    }

    // Handle audio messages
    if (item.messageType === 'audio') {
      return (
        <View style={styles.favoriteItem}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => openContactInfo(item)}
          >
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <Text style={[styles.avatarText, { color: theme.buttonText }]}>
                {item.sender_name ? item.sender_name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          </TouchableOpacity>

          <View
            style={[
              styles.messageContainer,
              item.isMe ? styles.myMessage : styles.otherMessage,
              { 
                backgroundColor: item.isMe ? theme.primary : theme.cardBackground,
                // Add a subtle border to make incoming messages more visible
                ...(!item.isMe && {
                  borderWidth: 1,
                  borderColor: theme.border,
                }),
              }
            ]}
          >
            {/* Audio message content - Text-like layout with waveform and play icon */}
            <View style={styles.textLikeAudioContainer}>
              <View style={styles.audioContentRow}>
                <TouchableOpacity 
                  style={[
                    styles.audioPlayButton,
                    {
                      backgroundColor: item.isMe 
                        ? 'rgba(255, 255, 255, 0.2)' 
                        : 'rgba(0, 0, 0, 0.1)'
                    }
                  ]}
                  onPress={() => playAudioMessage(item.audioUrl || item.file_url, item.id)}
                >
                  <Icon 
                    name={playingAudioId === item.id ? "pause" : "play-arrow"} 
                    size={24} 
                    color={item.isMe ? theme.buttonText : theme.text} 
                  />
                </TouchableOpacity>
                
                <View style={styles.audioWaveformContainer}>
                  <AudioWaveform 
                    isPlaying={playingAudioId === item.id}
                    duration={audioProgress[item.id]?.duration || 0}
                    currentTime={audioProgress[item.id]?.currentTime || 0}
                    color={item.isMe ? theme.buttonText : theme.text}
                    backgroundColor={item.isMe ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.1)'}
                    seed={item.id}
                    waveformBars={20}
                    time={item.time}
                    status={item.status}
                    isMyMessage={item.isMe}
                    theme={theme}
                  />
                </View>
              </View>
              
              {/* Time and status - positioned like text messages */}
              <View style={styles.messageInfo}>
                {item.isMe && (
                  <View style={styles.statusContainer}>
                    {item.status === 'sending' && (
                      <Icon name="schedule" size={16} color="#ffffffaa" />
                    )}
                    {item.status === 'sent' && (
                      <Icon name="done" size={16} color="#ffffffaa" />
                    )}
                    {item.status === 'delivered' && (
                      <Icon name="done-all" size={16} color="#cccccc" />
                    )}
                    {item.status === 'read' && (
                      <Icon name="done-all" size={16} color="#4FC3F7" />
                    )}
                  </View>
                )}
                <Text style={[styles.time, { color: item.isMe ? '#ffffffaa' : '#888' }]}>{item.time}</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    // Handle image messages
    if (item.messageType === 'image') {
      return (
        <View style={styles.favoriteItem}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => openContactInfo(item)}
          >
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <Text style={[styles.avatarText, { color: theme.buttonText }]}>
                {item.sender_name ? item.sender_name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => openChatWithMessage(item)}
            onLongPress={() => toggleFavorite(item.id, true)}
            delayLongPress={500}
            style={{
              alignSelf: item.isMe ? 'flex-end' : 'flex-start', // Align based on sender
              maxWidth: '80%',
            }}
          >
            <View style={{ position: 'relative' }}>
              <Image
                source={{ uri: item.imageUrl || item.file_url }}
                style={styles.imageMessage}
                resizeMode="cover"
              />
              {/* Time and status overlay */}
              <View style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 8, // Positioned relative to the image right edge
                  backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent background
                  borderRadius: 10,
                  paddingHorizontal: 6,
                  paddingVertical: 4,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}
              >
                {item.isMe && (
                  <View style={styles.statusContainer}>
                    {item.status === 'sending' && (
                      <Icon name="schedule" size={16} color="#ffffff" />
                    )}
                    {item.status === 'sent' && (
                      <Icon name="done" size={16} color="#ffffff" />
                    )}
                    {item.status === 'delivered' && (
                      <Icon name="done-all" size={16} color="#cccccc" />
                    )}
                    {item.status === 'read' && (
                      <Icon name="done-all" size={16} color="#4FC3F7" />
                    )}
                  </View>
                )}
                <Text style={[styles.time, { color: '#ffffff' }]}>{item.time}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    // Handle video messages
    if (item.messageType === 'video') {
      return (
        <View style={styles.favoriteItem}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => openContactInfo(item)}
          >
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <Text style={[styles.avatarText, { color: theme.buttonText }]}>
                {item.sender_name ? item.sender_name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => openChatWithMessage(item)}
            onLongPress={() => toggleFavorite(item.id, true)}
            delayLongPress={500}
            style={{
              alignSelf: item.isMe ? 'flex-end' : 'flex-start', // Align based on sender
              maxWidth: '80%',
            }}
          >
            <View style={{ position: 'relative' }}>
              <View style={styles.videoThumbnail}>
                <Icon name="play-arrow" size={40} color="#ffffff" />
              </View>
              {/* Time and status overlay */}
              <View style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 8, // Positioned relative to the video right edge
                  backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent background
                  borderRadius: 10,
                  paddingHorizontal: 6,
                  paddingVertical: 4,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}
              >
                {item.isMe && (
                  <View style={styles.statusContainer}>
                    {item.status === 'sending' && (
                      <Icon name="schedule" size={16} color="#ffffff" />
                    )}
                    {item.status === 'sent' && (
                      <Icon name="done" size={16} color="#ffffff" />
                    )}
                    {item.status === 'delivered' && (
                      <Icon name="done-all" size={16} color="#cccccc" />
                    )}
                    {item.status === 'read' && (
                      <Icon name="done-all" size={16} color="#4FC3F7" />
                    )}
                  </View>
                )}
                <Text style={[styles.time, { color: '#ffffff' }]}>{item.time}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    // Default text message rendering
    return (
      <View style={styles.favoriteItem}>
        {/* Avatar */}
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={() => openContactInfo(item)}
        >
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={[styles.avatarText, { color: theme.buttonText }]}>
              {item.sender_name ? item.sender_name.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Message content */}
        <TouchableOpacity
          style={[
            styles.messageContainer,
            item.isMe ? styles.myMessage : styles.otherMessage,
            { 
              backgroundColor: item.isMe ? theme.primary : theme.cardBackground,
              // Add a subtle border to make incoming messages more visible
              ...(!item.isMe && {
                borderWidth: 1,
                borderColor: theme.border,
              }),
            }
          ]}
          onPress={() => openChatWithMessage(item)}
        >
          <View style={styles.messageContent}>
            <Text
              style={[styles.messageText, { color: item.isMe ? theme.buttonText : theme.text }]}
              numberOfLines={3}
              ellipsizeMode="tail"
            >
              {item.text || `[${item.messageType}]`}
            </Text>
          </View>
          <View style={styles.messageInfo}>
            <Text style={[styles.time, { color: item.isMe ? '#ffffffaa' : '#888' }]}>{item.time}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading && favorites.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={{ color: theme.text }}>{t('loading')}...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title={t('favorites')} onBack={() => navigation.goBack()} />

      {favorites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="star-border" size={64} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.text }]}>{t('noFavoritesYet')}</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={favorites}
          renderItem={renderFavorite}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 10,
  },
  favoriteItem: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  avatarContainer: {
    marginRight: 10,
    marginTop: 5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  messageContainer: {
    maxWidth: '90%',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    marginVertical: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  messageWrapper: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 18,
    padding: 12,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderName: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  messageContent: {
    marginBottom: 8,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  time: {
    fontSize: 12,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  // Text-like audio message styles
  textLikeAudioContainer: {
    flexDirection: 'column',
  },
  audioContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioPlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  audioWaveformContainer: {
    justifyContent: 'center',
    marginRight: 6,
  },
  // Image message styles
  imageMessage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  imageMessageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  // Video message styles
  videoThumbnail: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Message container styles (similar to chat)
  myMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  mediaBubble: {
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 0,
    position: 'relative',
    flex: 0,                 // важно: НЕ растягиваться
  },

  timeOverlayWrap: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  timeOverlayText: {
    fontSize: 12,
    color: '#fff',
  },

});



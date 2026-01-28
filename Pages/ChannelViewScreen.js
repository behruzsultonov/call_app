import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import Header from '../components/Header';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ImageView from 'react-native-image-viewing';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

function ChannelViewScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();

  // Get channel data from navigation params
  const { channel } = route.params || {};
  const channelId = channel?.id;
  const channelName = channel?.title || channel?.name || 'Unknown Channel';
  const channelDescription = channel?.description || '';
  const channelUsername = channel?.username || '';
  const channelOwnerId = channel?.owner_id || channel?.created_by;
  const [isChannelOwner, setIsChannelOwner] = useState(channel?.is_owner === 1 || channel?.is_owner === true || false);
  const subscriberCount = channel?.subscriber_count || 0;
  const [isSubscribed, setIsSubscribed] = useState(channel?.is_subscribed || false);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [manualRefresh, setManualRefresh] = useState(false);
  const [userId, setUserId] = useState(null);
  const [input, setInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [visibleImageViewer, setVisibleImageViewer] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [fullscreenVideo, setFullscreenVideo] = useState(null);
  const textInputRef = useRef(null);
  const listRef = useRef(null);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [audioProgress, setAudioProgress] = useState({});

  const [matchIds, setMatchIds] = useState([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const activeMatchId = matchIds[activeMatchIndex];

  useEffect(() => {
    // Load user data and then messages
    loadUserData();

    // Load channel info if available
    if (channelId) {
      loadChannelInfo();
    }
  }, []);

  useEffect(() => {
    // Recalculate ownership when user ID or channel owner ID changes, but only if is_owner is not set from backend
    if (userId && channelOwnerId && !channel?.is_owner) {
      const ownershipCalculated = parseInt(userId) === parseInt(channelOwnerId);
      console.log('[CHANNEL VIEW] Recalculating ownership - User:', userId, 'Owner:', channelOwnerId, 'Result:', ownershipCalculated);
      setIsChannelOwner(ownershipCalculated);
    }
  }, [userId, channelOwnerId, channel?.is_owner]);

  useEffect(() => {
    // Log channel data for debugging
    console.log('[CHANNEL VIEW] Channel data received:', channel);
    console.log('[CHANNEL VIEW] Channel ID:', channelId);
    console.log('[CHANNEL VIEW] Channel Name:', channelName);
    console.log('[CHANNEL VIEW] Channel Owner ID:', channelOwnerId);
    console.log('[CHANNEL VIEW] Current User ID:', userId);
    console.log('[CHANNEL VIEW] Is Channel Owner (state):', isChannelOwner);
  }, [channel, channelId, userId, channelOwnerId, isChannelOwner]);

  useEffect(() => {
    // Load posts when we have both channelId and userId
    if (channelId && userId) {
      console.log('Channel ID:', channelId, 'User ID:', userId);
      loadChannelPosts();
    }
  }, [channelId, userId]);

  useEffect(() => {
    // если не поиск и пользователь был внизу — держим чат внизу
    if (!searchQuery && isAtBottom) {
      scrollToTop();
    }
  }, [posts, searchQuery]);

  // Simplified polling implementation for real-time updates
  // useEffect(() => {
  //   const loadChannel = () => {
  //     if (channelId && userId && !searchQuery) {
  //       loadChannelPosts(false); // Pass false to indicate this is not a manual refresh
  //     }
  //   };


  //   const subscription = AppState.addEventListener('change', nextAppState => {
  //     if (
  //       appState.current.match(/inactive|background/) &&
  //       nextAppState === 'active'
  //     ) {
  //       loadChannel();
  //     }
  //     appState.current = nextAppState;
  //   });


  //   return () => {
  //     subscription.remove();
  //     clearInterval(intervalId);
  //   };
  // }, [channelId, userId, searchQuery]);

  // Add useEffect to clean up audio when component unmounts
  useEffect(() => {
    return () => {
      if (playingAudioId) {
        stopAudioPlayback(playingAudioId);
      }
    };
  }, [playingAudioId]);

  // Load channel info when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (channelId) {
        loadChannelInfo();
      }
    });

    return unsubscribe;
  }, [navigation, channelId]);

  const loadUserData = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      const authToken = await AsyncStorage.getItem('authToken');

      if (userDataString && authToken) {
        const user = JSON.parse(userDataString);
        setUserId(user.id);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadChannelInfo = async () => {
    if (!channelId) return;

    try {
      const response = await api.getChannelById(channelId);

      if (response.data.success && response.data.data) {
        const channelData = response.data.data;
        setIsSubscribed(channelData.is_subscribed || false);

        // Use the is_owner field from the backend response
        if (channelData.is_owner !== undefined) {
          const ownershipStatus = channelData.is_owner === 1 || channelData.is_owner === true;
          setIsChannelOwner(ownershipStatus);
        } else {
          // Fallback to manual calculation if is_owner is not available
          if (userId && channelData.owner_id) {
            const ownershipStatus = parseInt(userId) === parseInt(channelData.owner_id);
            setIsChannelOwner(ownershipStatus);
          }
        }
      }
    } catch (error) {
      console.error('Error loading channel info:', error);
    }
  };

  const loadChannelPosts = async (isManualRefresh = false) => {
    if (!channelId || !userId) return;

    try {
      // Only set loading state for manual refreshes
      if (isManualRefresh) {
        setLoading(true);
        setManualRefresh(true);
      }

      const response = await api.getChannelPosts(channelId);

      if (response.data.success) {
        // Transform posts to match the expected format
        const formattedPosts = (response.data.data || []).map(post => {
          return {
            id: parseInt(post.id),
            text: post.text || '',
            time: post.created_at ? new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00',
            isMe: parseInt(post.author_id) === parseInt(userId),
            authorUsername: post.author_username || 'Unknown',
            mediaType: post.media_type || 'none',
            isDeleted: post.is_deleted === '1' || post.is_deleted === 1,
            imageUrl: post.media_url && post.media_type === 'image' ? `http://sadoapp.tj/callapp-be/${post.media_url}` : null,
            videoUrl: post.media_url && post.media_type === 'video' ? `http://sadoapp.tj/callapp-be/${post.media_url}` : null
          };
        });

        setPosts(formattedPosts);

        // после рендера чуть подождём и скроллим вверх (newest posts first)
        setTimeout(() => {
          scrollToTop();
        }, 100);
      } else {
        console.log('Failed to load posts:', response.data.message);
        if (!searchQuery || searchQuery.trim() === '') {
          setPosts([]);
        }
      }
    } catch (error) {
      console.log('Error loading posts:', error);
      if (!searchQuery || searchQuery.trim() === '') {
        setPosts([]);
      }
    } finally {
      // Only unset loading state for manual refreshes
      if (isManualRefresh) {
        setLoading(false);
        setManualRefresh(false);
      }
    }
  };

  const createPost = async () => {
    if (!input.trim() || !userId || !channelId) return;

    try {
      // Check if user is the channel owner before creating post
      if (!isChannelOwner) {
        Alert.alert(t('error'), t('notChannelOwnerCannotPost'));
        return;
      }

      // Create temporary post to show immediately
      const tempId = Date.now();
      const tempPost = {
        id: tempId,
        text: input,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true,
        authorUsername: 'You',
        mediaType: 'none',
        isDeleted: false
      };

      // Add temporary post to UI
      setPosts(prev => [tempPost, ...prev]);

      // Clear input
      setInput('');

      // Send post to server
      const postData = {
        channel_id: channelId,
        text: input,
        media_type: 'none'
      };

      console.log('Creating post:', postData);

      const response = await api.createChannelPost(postData);
      console.log('Create post response:', response.data);

      if (response.data.success && response.data.data) {
        // Replace temporary post with actual post from server
        setPosts(prev => {
          const updatedPosts = [tempPost, ...prev].filter(p => p.id !== tempId);
          updatedPosts.unshift({
            id: parseInt(response.data.data.id),
            text: response.data.data.text || input,
            time: response.data.data.created_at ?
              new Date(response.data.data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
              tempPost.time,
            isMe: parseInt(response.data.data.author_id) === parseInt(userId),
            authorUsername: response.data.data.author_username || 'Unknown',
            mediaType: response.data.data.media_type || 'none',
            isDeleted: false
          });
          return updatedPosts;
        });

        // Scroll to top to show new post
        setTimeout(() => scrollToTop(), 100);
      } else {
        // Remove temporary post if creating failed
        setPosts(prev => prev.filter(post => post.id !== tempId));
        Alert.alert(t('error'), response.data.message || t('failedToCreatePost'));
      }
    } catch (error) {
      // Remove temporary post if creating failed
      setPosts(prev => prev.filter(post => post.id !== tempId));
      console.log('Error creating post:', error);
      Alert.alert(t('error'), t('failedToCreatePost'));
    }
  };

  const handleSearch = async (query) => {
    if (query.trim() === '') {
      setSearchQuery('');
      loadChannelPosts();
      setIsSearching(false);
      return;
    }

    setSearchQuery(query);
    setIsSearching(true);

    try {
      // For now, we'll filter existing posts locally
      // In a real implementation, you might want to call an API endpoint
      const lowerQuery = query.toLowerCase();
      const filteredPosts = posts.filter(post =>
        (post.text || '').toLowerCase().includes(lowerQuery) ||
        (post.authorUsername || '').toLowerCase().includes(lowerQuery)
      );

      setPosts(filteredPosts);
    } catch (error) {
      console.error('Error searching posts:', error);
      setPosts([]);
    } finally {
      setIsSearching(false);
    }
  };

  const scrollToTop = () => {
    if (listRef.current) {
      listRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  };

  const getImageUrls = () => {
    return posts
      .filter(post => post.imageUrl)
      .map(post => ({ uri: post.imageUrl }));
  };

  const renderPost = ({ item }) => {
    if (item.isDeleted) {
      return (
        <View style={[styles.messageContainer, { alignSelf: 'center', backgroundColor: theme.cardBackground }]}>
          <Text style={{ color: theme.textSecondary, fontStyle: 'italic' }}>
            {t('messageDeleted')}
          </Text>
        </View>
      );
    }

    return (
      <View style={[
        styles.messageContainer,
        item.isMe ? styles.myMessage : styles.otherMessage,
        {
          backgroundColor: item.isMe ? theme.primary : theme.cardBackground,
          // Add margin for right-aligned messages (same as in ChatScreen)
          ...(item.isMe && {
            marginRight: 16,
          }),
        }
      ]}>
        {!item.isMe && (
          <Text style={[styles.authorUsername, { color: theme.textSecondary }]}>
            {channelName}
          </Text>
        )}

        {item.mediaType === 'image' && item.imageUrl ? (
          <TouchableOpacity onPress={() => {
            const imageIndex = getImageUrls().findIndex(img => img.uri === item.imageUrl);
            setImageViewerIndex(imageIndex);
            setVisibleImageViewer(true);
          }}>
            <Image source={{ uri: item.imageUrl }} style={styles.imageMessage} />
          </TouchableOpacity>
        ) : item.mediaType === 'video' && item.videoUrl ? (
          <TouchableOpacity
            style={styles.videoThumbnail}
            onPress={() => setFullscreenVideo({ videoUrl: item.videoUrl })}
          >
            <Icon name="play-arrow" size={40} color="#fff" />
          </TouchableOpacity>
        ) : null}

        <Text style={[styles.messageText, { color: item.isMe ? theme.buttonText : theme.text }]}>
          {item.text}
        </Text>

        <View style={styles.messageInfo}>
          <Text style={[styles.time, { color: item.isMe ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]}>
            {item.time}
          </Text>
        </View>
      </View>
    );
  };

  const handleEmojiPress = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };

  const selectImage = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
    };

    launchImageLibrary(options, async (response) => {
      if (response.didCancel || response.error) {
        console.log('Image picker cancelled or error:', response.error);
        return;
      }

      if (response.assets && response.assets.length > 0) {
        const imageAsset = response.assets[0];
        await sendImageMessage(imageAsset);
      }
    });
  };

  const sendImageMessage = async (imageAsset) => {
    if (!userId || !channelId) return;

    try {
      // Check if user is the channel owner before creating post
      if (!isChannelOwner) {
        Alert.alert(t('error'), t('notChannelOwnerCannotPost'));
        return;
      }

      // Create temporary post to show immediately
      const tempId = Date.now();
      const tempPost = {
        id: tempId,
        text: '',
        imageUrl: imageAsset.uri,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true,
        authorUsername: 'You',
        mediaType: 'image',
        isDeleted: false
      };

      // Add temporary post to UI
      setPosts(prev => [tempPost, ...prev]);

      // Create form data for image upload
      const formData = new FormData();
      formData.append('image', {
        uri: imageAsset.uri,
        type: imageAsset.type || 'image/jpeg',
        name: imageAsset.fileName || `image_${Date.now()}.jpg`,
      });
      formData.append('channel_id', channelId);
      formData.append('text', '');
      formData.append('media_type', 'image');

      console.log('Uploading image for post:', imageAsset.uri);

      // Send image to server
      const response = await api.createChannelPost({
        channel_id: channelId,
        text: '',
        media_type: 'image',
        media_url: imageAsset.uri
      });

      console.log('Create image post response:', response.data);

      if (response.data.success && response.data.data) {
        // Replace temporary post with actual post from server
        setPosts(prev => {
          const updatedPosts = [tempPost, ...prev].filter(p => p.id !== tempId);
          updatedPosts.unshift({
            id: parseInt(response.data.data.id),
            text: response.data.data.text || '',
            imageUrl: response.data.data.media_url ? `http://sadoapp.tj/callapp-be/${response.data.data.media_url}` : null,
            time: response.data.data.created_at ?
              new Date(response.data.data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
              tempPost.time,
            isMe: parseInt(response.data.data.author_id) === parseInt(userId),
            authorUsername: response.data.data.author_username || 'Unknown',
            mediaType: response.data.data.media_type || 'image',
            isDeleted: false
          });
          return updatedPosts;
        });

        // Scroll to top
        setTimeout(() => scrollToTop(), 100);
      } else {
        // Remove temporary post if creating failed
        setPosts(prev => prev.filter(post => post.id !== tempId));
        Alert.alert(t('error'), response.data.message || t('failedToCreatePost'));
      }
    } catch (error) {
      // Remove temporary post if creating failed
      setPosts(prev => prev.filter(post => post.id !== tempId));
      console.log('Error creating image post:', error);
      Alert.alert(t('error'), t('failedToCreatePost'));
    }
  };

  const selectVideo = () => {
    const options = {
      mediaType: 'video',
      quality: 0.8,
    };

    launchImageLibrary(options, async (response) => {
      if (response.didCancel || response.error) {
        console.log('Video picker cancelled or error:', response.error);
        return;
      }

      if (response.assets && response.assets.length > 0) {
        const videoAsset = response.assets[0];
        await sendVideoMessage(videoAsset);
      }
    });
  };

  const sendVideoMessage = async (videoAsset) => {
    if (!userId || !channelId) return;

    try {
      // Check if user is the channel owner before creating post
      if (!isChannelOwner) {
        Alert.alert(t('error'), t('notChannelOwnerCannotPost'));
        return;
      }

      // Create temporary post to show immediately
      const tempId = Date.now();
      const tempPost = {
        id: tempId,
        text: '',
        videoUrl: videoAsset.uri,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true,
        authorUsername: 'You',
        mediaType: 'video',
        isDeleted: false
      };

      // Add temporary post to UI
      setPosts(prev => [tempPost, ...prev]);

      // Send video to server
      const response = await api.createChannelPost({
        channel_id: channelId,
        text: '',
        media_type: 'video',
        media_url: videoAsset.uri
      });

      console.log('Create video post response:', response.data);

      if (response.data.success && response.data.data) {
        // Replace temporary post with actual post from server
        setPosts(prev => {
          const updatedPosts = [tempPost, ...prev].filter(p => p.id !== tempId);
          updatedPosts.unshift({
            id: parseInt(response.data.data.id),
            text: response.data.data.text || '',
            videoUrl: response.data.data.media_url ? `http://sadoapp.tj/callapp-be/${response.data.data.media_url}` : null,
            time: response.data.data.created_at ?
              new Date(response.data.data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
              tempPost.time,
            isMe: parseInt(response.data.data.author_id) === parseInt(userId),
            authorUsername: response.data.data.author_username || 'Unknown',
            mediaType: response.data.data.media_type || 'video',
            isDeleted: false
          });
          return updatedPosts;
        });

        // Scroll to top
        setTimeout(() => scrollToTop(), 100);
      } else {
        // Remove temporary post if creating failed
        setPosts(prev => prev.filter(post => post.id !== tempId));
        Alert.alert(t('error'), response.data.message || t('failedToCreatePost'));
      }
    } catch (error) {
      // Remove temporary post if creating failed
      setPosts(prev => prev.filter(post => post.id !== tempId));
      console.log('Error creating video post:', error);
      Alert.alert(t('error'), t('failedToCreatePost'));
    }
  };

  const handleSubscribe = async () => {
    if (!userId || !channelId) return;

    try {
      const action = isSubscribed ? 'unsubscribeFromChannel' : 'subscribeToChannel';
      const response = await api[action](channelId);

      if (response.data.success) {
        setIsSubscribed(!isSubscribed);
        
        // Reload channel info to get updated subscriber count
        await loadChannelInfo();
        
        if (isSubscribed) {
          navigation.navigate('Chats');
        }
      } else {
        Alert.alert(t('error'), response.data.message || t('failedToSubscribe'));
      }
    } catch (error) {
      console.log('Error subscribing/unsubscribing:', error);
      Alert.alert(t('error'), t('failedToSubscribe'));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ChannelInfo', { channel })}
        >
          <Header
            title={channelName}
            onBack={() => navigation.goBack()}
            subtitle={channel?.last_post_text ? channel.last_post_text : `${subscriberCount} subscribers`}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPost}
        inverted={true}
        contentContainerStyle={styles.chatList}
        onRefresh={() => loadChannelPosts(true)}
        refreshing={manualRefresh}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScroll={({ nativeEvent }) => {
          const { contentOffset, layoutMeasurement, contentSize } = nativeEvent;
          const isBottom = contentOffset.y <= 10;
          setIsAtBottom(isBottom);
        }}
      />

      {/* Show input for channel owner, subscribe button for others */}
      {isChannelOwner ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          <View style={[styles.inputContainer, {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          }]}>
            <TouchableOpacity onPress={() => {
              // Show action sheet for media selection - same as in ChatScreen
              Alert.alert(
                t('selectMedia'),
                t('chooseMediaType'),
                [
                  {
                    text: t('image'),
                    onPress: selectImage,
                  },
                  {
                    text: t('video'),
                    onPress: selectVideo,
                  },
                  {
                    text: t('cancel'),
                    style: 'cancel',
                  },
                ],
                { cancelable: true }
              );
            }}>
              <Icon name="attach-file" size={24} color={theme.textSecondary} />
            </TouchableOpacity>

            <TextInput
              ref={textInputRef}
              style={[styles.input, {
                color: theme.text,
              }]}
              placeholder={t('typePost')}
              placeholderTextColor={theme.textSecondary}
              value={input}
              onChangeText={setInput}
              multiline
              editable={true}
            />

            <View style={styles.rightIcons}>
              <TouchableOpacity style={styles.iconButton} onPress={handleEmojiPress}>
                <Icon name="mood" size={24} color="#888888" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconButton}
                onPress={input.trim() ? createPost : null}
                disabled={!input.trim()}
              >
                {input.trim() ? (
                  <Icon name="send" size={24} color={theme.primary} />
                ) : (
                  <Icon name="send" size={24} color={theme.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : (
        // Subscribe button for non-owners
        <View style={[styles.subscribeContainer, { backgroundColor: theme.cardBackground }]}>
          <TouchableOpacity
            style={[styles.subscribeButton, { backgroundColor: theme.primary }]}
            onPress={handleSubscribe}
          >
            <Text style={[styles.subscribeButtonText, { color: theme.buttonText }]}>
              {isSubscribed ? t('unsubscribe') : t('subscribe')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* модалки лучше держать снаружи KAV */}

      <Modal
        visible={!!fullscreenVideo}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setFullscreenVideo(null)}
      >
        <View style={styles.fullscreenVideoContainer}>
          {fullscreenVideo && (
            <>
              <Video
                source={{ uri: fullscreenVideo.videoUrl }}
                style={styles.fullscreenVideo}
                controls={true}
                resizeMode="contain"
                onError={(error) => console.log('Video playback error:', error)}
                onEnd={() => setFullscreenVideo(null)}
                paused={false}
                repeat={true}
              />
              <TouchableOpacity style={styles.closeFullscreenButton} onPress={() => setFullscreenVideo(null)}>
                <Icon name="close" size={30} color="#ffffff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  centerDate: {
    textAlign: 'center',
    marginVertical: 10,
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 10,
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

  myMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },

  otherMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },

  authorUsername: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },

  imageMessage: {
    width: 200,
    height: 200,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },

  videoThumbnail: {
    width: 200,
    height: 200,
    borderRadius: 15,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },

  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },

  time: {
    fontSize: 11,
    color: '#888',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 10,
    fontSize: 16,
    paddingVertical: 10,
  },

  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconButton: {
    padding: 8,
  },
  subscribeContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  subscribeButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
export default ChannelViewScreen;






























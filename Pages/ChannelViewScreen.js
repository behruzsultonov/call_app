import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Image,
  TouchableWithoutFeedback,
  Modal,
  AppState,
  KeyboardAvoidingView,
  SafeAreaView,
  Platform,
  Keyboard,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useWebRTC } from '../contexts/WebRTCContext';
import Icon from 'react-native-vector-icons/MaterialIcons';

import Header from '../components/Header';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { Picker } from 'emoji-mart-native';
import ImageView from 'react-native-image-viewing';
import Video from 'react-native-video';
import RNFS from 'react-native-fs';
import { PermissionsAndroid } from 'react-native';
import Sound from 'react-native-nitro-sound';
import AudioWaveform from '../components/AudioWaveform';

function ChannelViewScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { makeCall, userId: webRTCUserId } = useWebRTC();
  
  // Get channel data from navigation params
  const { channel } = route.params || {};
  const channelId = channel?.id;
  const channelName = channel?.title || channel?.name || 'Unknown Channel';
  const channelDescription = channel?.description || '';
  const channelUsername = channel?.username || '';
  const channelOwnerId = channel?.owner_id || channel?.created_by;
  const isChannelOwner = channel?.is_owner || (userId && channelOwnerId && parseInt(userId) === parseInt(channelOwnerId)) || false;
  const subscriberCount = channel?.subscriber_count || 0;
  const [isSubscribed, setIsSubscribed] = useState(channel?.is_subscribed || false);
    
  // Log incoming channel data
  console.log('[CHANNEL VIEW] Received channel data:', channel);
  console.log('[CHANNEL VIEW] Channel name for header:', channelName);
  console.log('[CHANNEL VIEW] Navigation state:', navigation.getState());
  console.log('[CHANNEL VIEW] Theme primary color:', theme.primary);
  console.log('[CHANNEL VIEW] Header background:', theme.headerBackground);
    
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
  const appState = useRef(AppState.currentState);
  
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
    
    // Log channel data for debugging
    console.log('[CHANNEL VIEW] Channel data received:', channel);
    console.log('[CHANNEL VIEW] Channel ID:', channelId);
    console.log('[CHANNEL VIEW] Channel Name:', channelName);
    console.log('[CHANNEL VIEW] Channel Owner ID:', channelOwnerId);
    console.log('[CHANNEL VIEW] Current User ID:', userId);
    console.log('[CHANNEL VIEW] Is Channel Owner:', isChannelOwner);
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
  useEffect(() => {
    const loadChannel = () => {
      if (channelId && userId && !searchQuery) {
        loadChannelPosts(false); // Pass false to indicate this is not a manual refresh
      }
    };

    const refreshChannel = () => {
      if (channelId && userId && !searchQuery) {
        loadChannelPosts(false); // Pass false to indicate this is not a manual refresh
      }
    };

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        loadChannel();
      }
      appState.current = nextAppState;
    });

    const intervalId = setInterval(() => {
      refreshChannel();
    }, 3000);

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, [channelId, userId, searchQuery]);

  // Add useEffect to clean up audio when component unmounts
  useEffect(() => {
    return () => {
      if (playingAudioId) {
        stopAudioPlayback(playingAudioId);
      }
    };
  }, [playingAudioId]);

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
      console.log('[CHANNEL VIEW] Loading channel info for ID:', channelId);
      const response = await api.getChannelById(channelId);
      console.log('[CHANNEL VIEW] Channel info response:', response.data);
      
      if (response.data.success && response.data.data) {
        const channelData = response.data.data;
        setIsSubscribed(channelData.is_subscribed || false);
        
        // Update ownership status if needed
        if (userId && channelData.owner_id) {
          const ownershipStatus = parseInt(userId) === parseInt(channelData.owner_id);
          console.log('[CHANNEL VIEW] Calculated ownership:', ownershipStatus);
          // Note: We can't update isChannelOwner directly since it's derived from props
          // The component will re-render when channel data updates
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
          alignSelf: item.isMe ? 'flex-end' : 'flex-start'
        }
      ]}>
        {!item.isMe && (
          <Text style={[styles.authorUsername, { color: theme.textSecondary }]}>
            {item.authorUsername}
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

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
      } else if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        sendImageMessage(asset);
      }
    });
  };

  const takePhoto = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
    };

    launchCamera(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled camera');
      } else if (response.error) {
        console.log('Camera Error: ', response.error);
      } else if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        sendImageMessage(asset);
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

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled video picker');
      } else if (response.error) {
        console.log('VideoPicker Error: ', response.error);
      } else if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        sendVideoMessage(asset);
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom', 'left', 'right']}>
      <Header 
        title={channelName}
        onBackPress={() => navigation.goBack()} 
        subtitle={`${subscriberCount} subscribers`}
      />
      {/* DEBUG: Visible back button test */}
      <TouchableOpacity 
        onPress={() => navigation.goBack()}
        style={{
          position: 'absolute',
          top: 50,
          left: 16,
          zIndex: 1000,
          backgroundColor: 'red',
          padding: 10,
          borderRadius: 20
        }}
      >
        <Text style={{color: 'white', fontWeight: 'bold'}}>BACK</Text>
      </TouchableOpacity>
      
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
        ListHeaderComponent={
          <Text style={[styles.centerDate, { color: theme.text, marginBottom: 10 }]}> {t('today')} </Text>
        }
      />

      {/* TEMPORARY: Show input for debugging - remove this in production */}
      {(isChannelOwner || true) && (
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          <View style={[styles.inputContainer, { 
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          }]}>
            <TouchableOpacity onPress={() => {
              Alert.alert(
                t('selectMedia'),
                t('chooseMediaType'),
                [
                  { text: t('camera'), onPress: takePhoto },
                  { text: t('gallery'), onPress: selectImage },
                  { text: t('video'), onPress: selectVideo },
                  { text: t('cancel'), style: 'cancel' }
                ]
              );
            }}>
              <Icon name="attach-file" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
            
            <TextInput
              ref={textInputRef}
              style={[styles.input, { 
                color: theme.text,
              }]}
              placeholder={isChannelOwner ? t('typePost') : t('notChannelOwner')}
              placeholderTextColor={theme.textSecondary}
              value={input}
              onChangeText={setInput}
              multiline
              editable={isChannelOwner}
            />
            
            <View style={styles.rightIcons}>
              <TouchableOpacity style={styles.iconButton} onPress={handleEmojiPress}>
                <Icon name="mood" size={24} color="#888888" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.iconButton}
                onPress={input.trim() && isChannelOwner ? createPost : null}
                disabled={!isChannelOwner}
              >
                {input.trim() && isChannelOwner ? (
                  <Icon name="send" size={24} color={theme.primary} />
                ) : (
                  <Icon name="send" size={24} color={theme.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* модалки лучше держать снаружи KAV */}
      <ImageView
        images={getImageUrls()}
        imageIndex={imageViewerIndex}
        visible={visibleImageViewer}
        onRequestClose={() => setVisibleImageViewer(false)}
        animationType="fade"
        presentationStyle="overFullScreen"
      />

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

  iconButton: {
    padding: 5,
    marginHorizontal: 2,
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

  fullscreenVideoContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  fullscreenVideo: {
    width: '100%',
    height: '100%',
  },

  closeFullscreenButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 10,
    zIndex: 999,
  }
});

export default ChannelViewScreen;

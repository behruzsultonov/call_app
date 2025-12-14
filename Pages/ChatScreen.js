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
  Modal
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ChatHeader from '../components/ChatHeader';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { Picker } from 'emoji-mart-native';
import ImageView from 'react-native-image-viewing';
import Video from 'react-native-video';
import RNFS from 'react-native-fs';
import { PermissionsAndroid, Platform } from 'react-native';
import Sound from 'react-native-nitro-sound';

export default function ChatScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [otherParticipantName, setOtherParticipantName] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [visibleImageViewer, setVisibleImageViewer] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [fullscreenVideo, setFullscreenVideo] = useState(null);
  const textInputRef = useRef(null);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Get chat data from navigation params
  const { chat } = route.params || {};
  const chatId = chat?.id;
  const chatName = chat?.name || 'Unknown Contact';
  const isPrivateChat = chat?.isPrivate;
  const otherParticipantId = chat?.otherParticipantId;

  useEffect(() => {
    // Load user data and then messages
    loadUserData();
    
    // For private chats, we might want to fetch the participant name if not provided
    if (isPrivateChat && otherParticipantId && !chatName) {
      loadParticipantName();
    }
  }, []);

  useEffect(() => {
    // Load messages when we have both chatId and userId
    if (chatId && userId) {
      console.log('Chat ID:', chatId, 'User ID:', userId);
      loadMessages();
    }
  }, [chatId, userId]); // Add userId to dependency array to ensure reload when it changes

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
  
  const loadMessages = async () => {
    if (!chatId || !userId) return;
    
    try {
      setLoading(true);
      console.log('Loading messages for chat:', chatId, 'user:', userId);
      
      const response = await api.getMessages(chatId, userId);
      console.log('Messages response:', response.data);
      
      if (response.data.success) {
        // Transform messages to match the expected format
        const formattedMessages = (response.data.data || []).map(msg => {
          const baseMessage = {
            id: parseInt(msg.id), // Ensure ID is integer
            text: msg.message_text || '',
            time: msg.sent_at ? new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00',
            isMe: parseInt(msg.sender_id) === parseInt(userId), // Compare as integers
            status: msg.status || 'sent', // Use status from message or default to 'sent'
            messageType: msg.message_type || 'text',
            // Handle deleted messages
            isDeleted: msg.is_deleted_for_everyone === '1' || 
                      msg.is_deleted_for_everyone === 1 ||
                      msg.is_deleted_for_me === '1' || 
                      msg.is_deleted_for_me === 1,
            deletedForEveryone: msg.is_deleted_for_everyone === '1' || msg.is_deleted_for_everyone === 1
          };
          
          // Add image or video URL based on message type
          if (msg.message_type === 'image' && msg.file_url) {
            // Use HTTP instead of HTTPS since HTTPS has certificate issues
            const baseUrl = 'http://sadoapp.tj/callapp-be/';
            baseMessage.imageUrl = `${baseUrl}${msg.file_url}`;
            console.log('Image URL for message:', baseMessage.id, baseMessage.imageUrl);
          } else if (msg.message_type === 'video' && msg.file_url) {
            baseMessage.videoUrl = `http://sadoapp.tj/callapp-be/${msg.file_url}`;
          } else if (msg.message_type === 'audio' && msg.file_url) {
            baseMessage.audioUrl = `http://sadoapp.tj/callapp-be/${msg.file_url}`;
          }
          
          return baseMessage;
        });
        
        console.log('Formatted messages:', formattedMessages);
        setMessages(formattedMessages);
      } else {
        console.log('Failed to load messages:', response.data.message);
        setMessages([]);
      }
    } catch (error) {
      console.log('Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !userId || !chatId) return;
    
    try {
      // Create temporary message to show immediately
      const tempId = Date.now(); // Temporary ID
      const tempMessage = {
        id: tempId,
        text: input,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true,
        status: 'sent',
        messageType: 'text'
      };
      
      // Add temporary message to UI
      setMessages(prev => [...prev, tempMessage]);
      
      // Clear input
      setInput('');
      
      // Send message to server
      const messageData = {
        chat_id: chatId,
        sender_id: userId,
        message_text: input,
        message_type: 'text'
      };
      
      console.log('Sending message:', messageData);
      
      const response = await api.sendMessage(messageData);
      console.log('Send message response:', response.data);
      
      if (response.data.success && response.data.data) {
        // Replace temporary message with actual message from server
        setMessages(prev => {
          const updatedMessages = [...prev];
          const tempIndex = updatedMessages.findIndex(msg => msg.id === tempId);
          if (tempIndex !== -1) {
            updatedMessages[tempIndex] = {
              id: parseInt(response.data.data.id),
              text: response.data.data.message_text || input,
              time: response.data.data.sent_at ? 
                new Date(response.data.data.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                tempMessage.time,
              isMe: parseInt(response.data.data.sender_id) === parseInt(userId), // Compare as integers
              status: response.data.data.status || 'delivered',
              messageType: response.data.data.message_type || 'text'
            };
          }
          return updatedMessages;
        });
      } else {
        // Remove temporary message if sending failed
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        Alert.alert(t('error'), response.data.message || t('failedToSendMessage'));
      }
    } catch (error) {
      // Remove temporary message if sending failed
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      console.log('Error sending message:', error);
      Alert.alert(t('error'), t('failedToSendMessage'));
    }
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
        await sendImage(imageAsset);
      }
    });
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
        await sendVideo(videoAsset);
      }
    });
  };

  const sendImage = async (imageAsset) => {
    if (!userId || !chatId) return;

    try {
      // Create temporary message to show immediately
      const tempId = Date.now(); // Temporary ID
      const tempMessage = {
        id: tempId,
        text: '',
        imageUrl: imageAsset.uri,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true,
        status: 'sending',
        messageType: 'image'
      };

      // Add temporary message to UI
      setMessages(prev => [...prev, tempMessage]);

      // Create form data for image upload
      const formData = new FormData();
      formData.append('image', {
        uri: imageAsset.uri,
        type: imageAsset.type || 'image/jpeg',
        name: imageAsset.fileName || `image_${Date.now()}.jpg`,
      });
      formData.append('chat_id', chatId);
      formData.append('sender_id', userId);

      console.log('Uploading image:', imageAsset.uri);

      // Send image to server
      const response = await api.uploadImage(formData);
      console.log('Upload image response:', response.data);

      if (response.data.success && response.data.data) {
        // Replace temporary message with actual message from server
        setMessages(prev => {
          const updatedMessages = [...prev];
          const tempIndex = updatedMessages.findIndex(msg => msg.id === tempId);
          if (tempIndex !== -1) {
            updatedMessages[tempIndex] = {
              id: parseInt(response.data.data.id),
              text: response.data.data.message_text || '',
              imageUrl: response.data.data.file_url ? `http://sadoapp.tj/callapp-be/${response.data.data.file_url}` : null,
              time: response.data.data.sent_at ? 
                new Date(response.data.data.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                tempMessage.time,
              isMe: parseInt(response.data.data.sender_id) === parseInt(userId),
              status: response.data.data.status || 'delivered',
              messageType: response.data.data.message_type || 'image'
            };
            console.log('Updated message with image URL:', updatedMessages[tempIndex]);
          }
          return updatedMessages;
        });
      } else {
        // Remove temporary message if sending failed
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        Alert.alert(t('error'), response.data.message || t('failedToSendImage'));
      }
    } catch (error) {
      // Remove temporary message if sending failed
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      console.log('Error sending image:', error);
      Alert.alert(t('error'), t('failedToSendImage'));
    }
  };

  const sendVideo = async (videoAsset) => {
    if (!userId || !chatId) return;

    try {
      // Create temporary message to show immediately
      const tempId = Date.now(); // Temporary ID
      const tempMessage = {
        id: tempId,
        text: '',
        videoUrl: videoAsset.uri,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true,
        status: 'sending',
        messageType: 'video'
      };

      // Add temporary message to UI
      setMessages(prev => [...prev, tempMessage]);

      // Create form data for video upload
      const formData = new FormData();
      formData.append('video', {
        uri: videoAsset.uri,
        type: videoAsset.type || 'video/mp4',
        name: videoAsset.fileName || `video_${Date.now()}.mp4`,
      });
      formData.append('chat_id', chatId);
      formData.append('sender_id', userId);

      console.log('Uploading video:', videoAsset.uri);

      // Send video to server
      const response = await api.uploadVideo(formData);
      console.log('Upload video response:', response.data);

      if (response.data.success && response.data.data) {
        // Replace temporary message with actual message from server
        setMessages(prev => {
          const updatedMessages = [...prev];
          const tempIndex = updatedMessages.findIndex(msg => msg.id === tempId);
          if (tempIndex !== -1) {
            updatedMessages[tempIndex] = {
              id: parseInt(response.data.data.id),
              text: response.data.data.message_text || '',
              videoUrl: response.data.data.file_url ? `https://sadoapp.tj/callapp-be/${response.data.data.file_url}` : null,
              time: response.data.data.sent_at ? 
                new Date(response.data.data.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                tempMessage.time,
              isMe: parseInt(response.data.data.sender_id) === parseInt(userId),
              status: response.data.data.status || 'delivered',
              messageType: response.data.data.message_type || 'video'
            };
          }
          return updatedMessages;
        });
      } else {
        // Remove temporary message if sending failed
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        Alert.alert(t('error'), response.data.message || t('failedToSendVideo'));
      }
    } catch (error) {
      // Remove temporary message if sending failed
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      console.log('Error sending video:', error);
      Alert.alert(t('error'), t('failedToSendVideo'));
    }
  };

  const loadParticipantName = async () => {
    if (!otherParticipantId) return;
    
    try {
      const response = await api.getUser(otherParticipantId);
      if (response.data.success && response.data.data) {
        setOtherParticipantName(response.data.data.username);
      }
    } catch (error) {
      console.error('Error loading participant name:', error);
    }
  };

  const renderMessage = ({ item, index }) => {
    // Handle deleted messages
    if (item.isDeleted) {
      return (
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
      );
    }

    if (item.messageType === 'image') {
      console.log('Rendering image message:', item);
      return (
        <TouchableWithoutFeedback onLongPress={() => handleLongPressMessage(item)}>
          <View
            style={{
              maxWidth: '80%',
              padding: 2, // Minimal padding
              position: 'relative', // For absolute positioning of time/status
              alignSelf: item.isMe ? 'flex-end' : 'flex-start', // Align based on sender
            }}
          >
            <TouchableOpacity onPress={() => openImageViewer(item)}>
              <Image 
                source={{ uri: item.imageUrl }} 
                style={styles.imageMessage}
                resizeMode="cover"
                onError={(error) => console.log('Image load error:', error, 'URL:', item.imageUrl)}
                onLoad={() => console.log('Image loaded successfully:', item.imageUrl)}
              />
            </TouchableOpacity>
            {/* Time and status overlay */}
            <View style={[
              styles.imageMessageInfo,
              {
                position: 'absolute',
                bottom: 4,
                right: 8,
                backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent background
                borderRadius: 10,
                paddingHorizontal: 6,
                paddingVertical: 2
              }
            ]}>
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
        </TouchableWithoutFeedback>
      );
    }

    if (item.messageType === 'video') {
      return (
        <TouchableWithoutFeedback onLongPress={() => handleLongPressMessage(item)}>
          <View
            style={{
              maxWidth: '80%',
              padding: 2, // Minimal padding
              position: 'relative', // For absolute positioning of time/status
              alignSelf: item.isMe ? 'flex-end' : 'flex-start', // Align based on sender
            }}
          >
            <TouchableOpacity onPress={() => setFullscreenVideo(item)}>
              <View style={styles.videoThumbnail}>
                <Icon name="play-arrow" size={40} color="#ffffff" />
              </View>
            </TouchableOpacity>
            {/* Time and status overlay */}
            <View style={[
              styles.imageMessageInfo,
              {
                position: 'absolute',
                bottom: 4,
                right: 8,
                backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent background
                borderRadius: 10,
                paddingHorizontal: 6,
                paddingVertical: 2
              }
            ]}>
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
        </TouchableWithoutFeedback>
      );
    }

    // Handle audio messages
    if (item.messageType === 'audio') {
      return (
        <TouchableWithoutFeedback onLongPress={() => handleLongPressMessage(item)}>
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
                flexDirection: 'row',
                alignItems: 'center',
                maxWidth: '80%',
                paddingVertical: 8,
                paddingHorizontal: 12,
              }
            ]}
          >
            <TouchableOpacity 
              style={{ 
                padding: 5,
                marginRight: 10,
              }}
              onPress={() => playAudioMessage(item.audioUrl)}
            >
              <Icon 
                name="play-arrow" 
                size={24} 
                color={item.isMe ? theme.buttonText : theme.text} 
              />
            </TouchableOpacity>
            
            <View style={{ flex: 1 }}>
              <Text style={[styles.messageText, { 
                color: item.isMe ? theme.buttonText : theme.text,
                fontStyle: 'italic'
              }]}>
                {t('voiceMessage')}
              </Text>
              
              <View style={styles.messageInfo}>
                {item.isMe && (
                  <View style={styles.statusContainer}>
                    {item.status === 'sending' && (
                      <Icon name="schedule" size={16} color={item.isMe ? '#ffffffaa' : '#888'} />
                    )}
                    {item.status === 'sent' && (
                      <Icon name="done" size={16} color={item.isMe ? '#ffffffaa' : '#888'} />
                    )}
                    {item.status === 'delivered' && (
                      <Icon name="done-all" size={16} color={item.isMe ? '#cccccc' : '#888'} />
                    )}
                    {item.status === 'read' && (
                      <Icon name="done-all" size={16} color={item.isMe ? '#4FC3F7' : '#888'} />
                    )}
                  </View>
                )}
                <Text style={[styles.time, { color: item.isMe ? '#ffffffaa' : '#888' }]}>{item.time}</Text>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      );
    }

    return (      <TouchableWithoutFeedback onLongPress={() => handleLongPressMessage(item)}>
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
          <Text style={[styles.messageText, { color: item.isMe ? theme.buttonText : theme.text }]}>{item.text}</Text>
          <View style={styles.messageInfo}>
            {item.isMe && (
              <View style={styles.statusContainer}>
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
      </TouchableWithoutFeedback>
    );
  };

  // Function to open image viewer
  const openImageViewer = (message) => {
    // Get all image messages
    const imageMessages = messages.filter(msg => msg.messageType === 'image' && msg.imageUrl);
    
    console.log('Opening image viewer for message:', message);
    console.log('All image messages:', imageMessages);
    
    // Find the index of the clicked message
    const index = imageMessages.findIndex(imgMsg => imgMsg.id === message.id);
    
    console.log('Found index:', index);
    console.log('Image URLs for viewer:', getImageUrls());
    
    if (index !== -1) {
      setImageViewerIndex(index);
      setVisibleImageViewer(true);
    } else {
      console.log('Could not find message in image messages array');
    }
  };

  // Function to get image URLs for the image viewer
  const getImageUrls = () => {
    const imageUrls = messages
      .filter(message => message.messageType === 'image' && message.imageUrl)
      .map((message, index) => {
        console.log('Mapping image message to URL:', message);
        // For react-native-image-viewing, we need to return objects with a 'uri' property
        return { 
          uri: message.imageUrl
        };
      });
    
    console.log('Image URLs for viewer:', imageUrls);
    return imageUrls;
  };

  const handleEmojiPress = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };
  
  const addEmoji = (emoji) => {
    setInput(input + emoji.native);
    if (textInputRef.current) {
      textInputRef.current.focus();
    }
  };
  
  const handleLongPressMessage = (message) => {
    // Only allow the sender to delete their own messages
    if (message.isMe) {
      Alert.alert(
        t('deleteMessage'),
        t('deleteMessageConfirmation'),
        [
          {
            text: t('cancel'),
            style: 'cancel'
          },
          {
            text: t('deleteForMe'),
            onPress: () => deleteMessage(message.id, false)
          },
          {
            text: t('deleteForEveryone'),
            onPress: () => deleteMessage(message.id, true)
          }
        ],
        { cancelable: true }
      );
    } else {
      // For messages from others, only allow delete for me
      Alert.alert(
        t('deleteMessage'),
        t('deleteMessageConfirmation'),
        [
          {
            text: t('cancel'),
            style: 'cancel'
          },
          {
            text: t('deleteForMe'),
            onPress: () => deleteMessage(message.id, false)
          }
        ],
        { cancelable: true }
      );
    }
  };
  
  const deleteMessage = async (messageId, deleteForEveryone = false) => {
    if (!userId) return;
    
    try {
      const response = await api.deleteMessage({
        message_id: messageId,
        user_id: userId,
        delete_for_everyone: deleteForEveryone
      });
      
      if (response.data.success) {
        // Update the message in the UI to show it as deleted
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === messageId 
              ? { 
                  ...msg, 
                  isDeleted: true,
                  deletedForEveryone: deleteForEveryone
                } 
              : msg
          )
        );
        console.log('Message deleted successfully');
      } else {
        console.log('Failed to delete message:', response.data.message);
        Alert.alert(t('error'), response.data.message || t('failedToDeleteMessage'));
      }
    } catch (error) {
      console.log('Error deleting message:', error);
      Alert.alert(t('error'), t('failedToDeleteMessage'));
    }
  };

  // Add voice recording functions
  const requestAudioPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        // For Android 13+, we only need RECORD_AUDIO permission
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: t('audioPermissionTitle'),
            message: t('audioPermissionMessage'),
            buttonNeutral: t('askLater'),
            buttonNegative: t('cancel'),
            buttonPositive: t('ok'),
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // iOS permissions are handled differently
  };

  const startRecording = async () => {
    try {
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        Alert.alert(t('permissionDenied'), t('audioPermissionRequired'));
        return;
      }

      // Create a temporary file path for the recording
      const fileName = `voice_message_${Date.now()}.aac`;
      let path;
      
      if (Platform.OS === 'android') {
        path = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      } else {
        path = `${RNFS.LibraryDirectoryPath}/${fileName}`;
      }

      // Set up recording progress listener
      Sound.addRecordBackListener((e) => {
        // Update recording time in seconds
        setRecordingTime(Math.floor(e.currentPosition / 1000));
      });

      // Start recording with the specified path
      const result = await Sound.startRecorder(path);
      console.log('Recording started:', result);
      
      // Start recording
      setIsRecording(true);
      setRecordingTime(0);

      // Store recording info
      setRecording({
        path,
        fileName,
      });

      console.log('Recording started at:', path);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert(t('error'), t('failedToStartRecording'));
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      // Stop recording
      const result = await Sound.stopRecorder();
      console.log('Recording stopped:', result);
      
      // Remove recording listener
      Sound.removeRecordBackListener();
      
      setIsRecording(false);
      setRecordingTime(0);
      
      // Store recording info locally before clearing state
      const recordingInfo = recording;

      // Clear recording state
      setRecording(null);

      if (recordingInfo) {
        // Send the recorded audio
        await sendVoiceMessage(recordingInfo.path, recordingInfo.fileName);
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert(t('error'), t('failedToStopRecording'));
      // Make sure to clean up state even if there's an error
      setIsRecording(false);
      setRecordingTime(0);
      setRecording(null);
    }
  };

  const sendVoiceMessage = async (filePath, fileName) => {
    if (!userId || !chatId) return;

    try {
      // Create temporary message to show immediately
      const tempId = Date.now(); // Temporary ID
      const tempMessage = {
        id: tempId,
        text: '',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true,
        status: 'sending',
        messageType: 'audio'
      };

      // Add temporary message to UI
      setMessages(prev => [...prev, tempMessage]);

      // Create form data for audio upload
      const formData = new FormData();
      formData.append('audio', {
        uri: `file://${filePath}`,
        type: 'audio/aac',
        name: fileName,
      });
      formData.append('chat_id', chatId);
      formData.append('sender_id', userId);

      console.log('Uploading audio:', filePath);

      // Send audio to server
      const response = await api.uploadAudio(formData);
      console.log('Upload audio response:', response.data);

      if (response.data.success && response.data.data) {
        // Replace temporary message with actual message from server
        setMessages(prev => {
          const updatedMessages = [...prev];
          const tempIndex = updatedMessages.findIndex(msg => msg.id === tempId);
          if (tempIndex !== -1) {
            updatedMessages[tempIndex] = {
              id: parseInt(response.data.data.id),
              text: response.data.data.message_text || '',
              audioUrl: response.data.data.file_url ? `http://sadoapp.tj/callapp-be/${response.data.data.file_url}` : null,
              time: response.data.data.sent_at ? 
                new Date(response.data.data.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                tempMessage.time,
              isMe: parseInt(response.data.data.sender_id) === parseInt(userId),
              status: response.data.data.status || 'delivered',
              messageType: response.data.data.message_type || 'audio'
            };
            console.log('Updated message with audio URL:', updatedMessages[tempIndex]);
          }
          return updatedMessages;
        });
      } else {
        // Remove temporary message if sending failed
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        Alert.alert(t('error'), response.data.message || t('failedToSendAudio'));
      }
    } catch (error) {
      // Remove temporary message if sending failed
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      console.log('Error sending audio:', error);
      Alert.alert(t('error'), t('failedToSendAudio'));
    }
  };

  const playAudioMessage = async (audioUrl) => {
    try {
      // Set up playback progress listener
      Sound.addPlayBackListener((e) => {
        console.log('Playback progress:', e.currentPosition, e.duration);
      });

      // Set up playback end listener
      Sound.addPlaybackEndListener((e) => {
        console.log('Playback completed:', e);
        // Clean up listeners when playback completes
        Sound.removePlayBackListener();
        Sound.removePlaybackEndListener();
      });

      // Start playback
      const result = await Sound.startPlayer(audioUrl);
      console.log('Playback started:', result);
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert(t('error'), t('failedToPlayAudio'));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ChatHeader 
        title={otherParticipantName || chatName}
        onBackPress={() => navigation.goBack()} 
        onCallPress={() => console.log('Call pressed')}
        onVideoCallPress={() => console.log('Video call pressed')}
        onContactInfoPress={() => {
          // Pass contact data when navigating to ContactInfo screen
          if (isPrivateChat && otherParticipantId) {
            navigation.navigate('ContactInfo', {
              contact: {
                name: otherParticipantName || chatName,
                phone: '', // We would need to fetch this from the API
                status: 'green',
                id: otherParticipantId
              }
            });
          } else {
            navigation.navigate('ContactInfo');
          }
        }}
      />
      
      <FlatList
        data={messages}
        renderItem={({ item, index }) => renderMessage({ item, index })}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 10, flexGrow: 1, justifyContent: 'flex-end' }}
        ListHeaderComponent={
          <Text style={[styles.centerDate, { color: theme.text, marginBottom: 10 }]}>{t('today')}</Text>
        }
        onRefresh={loadMessages}
        refreshing={loading}
      />
      
      {/* Image Viewer Modal */}
      <ImageView
        images={getImageUrls()}
        imageIndex={imageViewerIndex}
        visible={visibleImageViewer}
        onRequestClose={() => setVisibleImageViewer(false)}
        animationType="fade"
        presentationStyle="overFullScreen"
      />
      
      {/* Fullscreen Video Modal */}
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
              <TouchableOpacity 
                style={styles.closeFullscreenButton}
                onPress={() => setFullscreenVideo(null)}
              >
                <Icon name="close" size={30} color="#ffffff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
      
      {/* Emoji Picker - Positioned directly above the input field */}
      {showEmojiPicker && (
        <View style={[styles.emojiPickerContainer, { backgroundColor: theme.cardBackground, borderTopColor: theme.border }]}>
          <Picker
            onSelect={addEmoji}
            showPreview={false}
            showSkinTones={false}
            perLine={10}
            emojiSize={20}
            sheetSize={32}
            autoFocus={false}
            color="#888888"
            include={['people', 'nature', 'foods', 'activity', 'places', 'objects', 'symbols', 'flags']}
            showCloseButton={true}
            onPressClose={() => setShowEmojiPicker(false)}
            i18n={{
              search: t('searchEmojis'),
              notfound: t('noEmojiFound'),
              categories: {
                search: t('searchResults'),
                recent: t('frequentlyUsed'),
                people: t('smileysAndPeople'),
                nature: t('animalsAndNature'),
                foods: t('foodAndDrink'),
                activity: t('activity'),
                places: t('travelAndPlaces'),
                objects: t('objects'),
                symbols: t('symbols'),
                flags: t('flags'),
                custom: t('custom')
              }
            }}
            style={{ 
              width: '100%', 
              backgroundColor: 'transparent',
              borderWidth: 0,
            }}
          />
        </View>
      )}
      
      {/* Input Field */}
      <View style={[styles.inputContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <TouchableOpacity style={styles.iconButton} onPress={() => {
          // Show action sheet for media selection
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
                text: t('voiceMessage'),
                onPress: isRecording ? stopRecording : startRecording,
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
          placeholder={t('typeMessage')}
          placeholderTextColor={theme.textSecondary}
          value={input}
          onChangeText={setInput}
          multiline
        />
        
        <View style={styles.rightIcons}>
          <TouchableOpacity style={styles.iconButton} onPress={handleEmojiPress}>
            <Icon name="mood" size={24} color="#888888" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.iconButton}
            onLongPress={isRecording ? stopRecording : startRecording}
            onPress={input.trim() ? sendMessage : () => {
              if (isRecording) {
                stopRecording();
              } else {
                startRecording();
              }
            }}
          >
            {input.trim() ? (
              <Icon name="send" size={24} color={theme.primary} />
            ) : isRecording ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: 'red',
                  marginRight: 5
                }} />
                <Text style={{ color: 'red', fontSize: 12 }}>{`${recordingTime || 0}s`}</Text>
              </View>
            ) : (
              <Icon name="mic" size={24} color={theme.textSecondary} />
            )}
          </TouchableOpacity>        </View>
      </View>
    </View>
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
    maxWidth: '80%',
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

  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },

  imageMessage: {
    width: 200,
    height: 200,
    borderRadius: 15, // Consistent rounding
    borderWidth: 1, // Border
    borderColor: 'rgba(0,0,0,0.1)', // Light border color
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

  videoPlayerContainer: {
    width: 200,
    height: 200,
    borderRadius: 15,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },

  videoPlayer: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
  },

  closeVideoButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 2,
  },

  imageMessageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingBottom: 4,
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

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
    // marginTop: 8
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

  sendButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
  },

  emojiPickerContainer: {
    width: '100%',
    backgroundColor: '#f0f0f0',
    padding: 0,
    margin: 0,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    // Ensure the container takes full width and has no internal spacing
    alignItems: 'stretch',
    justifyContent: 'flex-start',
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
  },

});



































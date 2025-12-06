import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ChatHeader from '../components/ChatHeader';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';

export default function ChatScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  
  // Get chat data from navigation params
  const { chat } = route.params || {};
  const chatId = chat?.id || 1; // Default to chat 1 if not provided
  const chatName = chat?.name || 'Unknown Contact';

  useEffect(() => {
    console.log('ChatScreen mounted with params:', route.params);
    console.log('Chat ID:', chatId);
    
    // Load user data and then messages
    loadUserData();
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
            messageType: msg.message_type || 'text'
          };
          
          // Add image or video URL based on message type
          if (msg.message_type === 'image' && msg.file_url) {
            baseMessage.imageUrl = `https://sadoapp.tj/callapp-be/${msg.file_url}`;
          } else if (msg.message_type === 'video' && msg.file_url) {
            baseMessage.videoUrl = `https://sadoapp.tj/callapp-be/${msg.file_url}`;
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
    if (!input.trim() || !userId) return;
    
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
    if (!userId) return;

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
              imageUrl: response.data.data.file_url ? `https://sadoapp.tj/callapp-be/${response.data.data.file_url}` : null,
              time: response.data.data.sent_at ? 
                new Date(response.data.data.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                tempMessage.time,
              isMe: parseInt(response.data.data.sender_id) === parseInt(userId),
              status: response.data.data.status || 'delivered',
              messageType: response.data.data.message_type || 'image'
            };
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
    if (!userId) return;

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

  const renderMessage = ({ item }) => {
    if (item.messageType === 'image') {
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
              maxWidth: '80%',
              padding: 0,
            }
          ]}
        >
          <Image 
            source={{ uri: item.imageUrl }} 
            style={styles.imageMessage}
            resizeMode="cover"
          />
          <View style={styles.imageMessageInfo}>
            <Text style={[styles.time, { color: item.isMe ? '#ffffffaa' : '#888' }]}>{item.time}</Text>
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
          </View>
        </View>
      );
    }

    if (item.messageType === 'video') {
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
              maxWidth: '80%'
            }
          ]}
        >
          <TouchableOpacity onPress={() => console.log('Play video:', item.videoUrl)}>
            <View style={styles.videoThumbnail}>
              <Icon name="play-arrow" size={40} color="#ffffff" />
            </View>
          </TouchableOpacity>
          <View style={styles.imageMessageInfo}>
            <Text style={[styles.time, { color: item.isMe ? '#ffffffaa' : '#888' }]}>{item.time}</Text>
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
          </View>
        </View>
      );
    }

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
          }
        ]}
      >
        <Text style={[styles.messageText, { color: item.isMe ? theme.buttonText : theme.text }]}>{item.text}</Text>
        <View style={styles.messageInfo}>
          <Text style={[styles.time, { color: item.isMe ? '#ffffffaa' : '#888' }]}>{item.time}</Text>
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
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ChatHeader 
        onBackPress={() => navigation.goBack()} 
        onCallPress={() => console.log('Call pressed')}
        onVideoCallPress={() => console.log('Video call pressed')}
        onContactInfoPress={() => navigation.navigate('ContactInfo')}
      />
      
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 10, flexGrow: 1, justifyContent: 'flex-end' }}
        ListHeaderComponent={
          <Text style={[styles.centerDate, { color: theme.text, marginBottom: 10 }]}>{t('today')}</Text>
        }
        onRefresh={loadMessages}
        refreshing={loading}
      />

      {/* Поле ввода */}
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
          <TouchableOpacity style={styles.iconButton}>
            <Icon name="mood" size={24} color="#888888" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={input.trim() ? sendMessage : () => console.log('Microphone pressed')}
          >
            {input.trim() ? (
              <Icon name="send" size={24} color={theme.primary} />
            ) : (
              <Icon name="mic" size={24} color={theme.textSecondary} />
            )}
          </TouchableOpacity>
        </View>
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
    borderRadius: 10,
  },

  videoThumbnail: {
    width: 200,
    height: 200,
    borderRadius: 10,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 8
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
});
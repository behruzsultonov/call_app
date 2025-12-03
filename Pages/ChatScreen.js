import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ChatHeader from '../components/ChatHeader';

export default function ChatScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(1); // Test user ID
  
  // Get chat data from navigation params
  const { chat } = route.params || {};
  const chatId = chat?.id || 1; // Default to chat 1 if not provided
  const chatName = chat?.name || 'Unknown Contact';

  useEffect(() => {
    console.log('ChatScreen mounted with params:', route.params);
    console.log('Chat ID:', chatId);
    
    // Load messages
    loadMessages();
  }, []);

  useEffect(() => {
    // Load messages when we have both chatId and userId
    if (chatId && userId) {
      console.log('Chat ID:', chatId, 'User ID:', userId);
      loadMessages();
    }
  }, [chatId, userId]); // Add userId to dependency array to ensure reload when it changes

  const loadMessages = async () => {
    
    try {
      setLoading(true);
      console.log('Loading messages for chat:', chatId, 'user:', userId);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Test data for messages
      const response = {
        data: {
          success: true,
          message: 'Messages retrieved successfully',
          data: [
            {
              id: 1,
              message_text: 'Hello there!',
              sender_id: 2,
              sent_at: '2023-05-15T10:30:00Z',
              status: 'read'
            },
            {
              id: 2,
              message_text: 'Hi! How are you doing?',
              sender_id: 1, // Current user
              sent_at: '2023-05-15T10:32:00Z',
              status: 'read'
            },
            {
              id: 3,
              message_text: 'I\'m doing great, thanks for asking!',
              sender_id: 2,
              sent_at: '2023-05-15T10:35:00Z',
              status: 'read'
            }
          ]
        }
      };
      console.log('Messages response:', response.data);
      
      if (response.data.success) {
        // Transform messages to match the expected format
        const formattedMessages = (response.data.data || []).map(msg => ({
          id: parseInt(msg.id), // Ensure ID is integer
          text: msg.message_text || '',
          time: msg.sent_at ? new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00',
          isMe: parseInt(msg.sender_id) === parseInt(userId), // Compare as integers
          status: msg.status || 'read', // Use status from message or default to 'read'
        }));
        
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
    if (!input.trim()) return;
    
    try {
      // Create temporary message to show immediately
      const tempId = Date.now(); // Temporary ID
      const tempMessage = {
        id: tempId,
        text: input,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true,
        status: 'sent',
      };
      
      // Add temporary message to UI
      setMessages(prev => [...prev, tempMessage]);
      
      // Clear input
      setInput('');
      
      // Send message to server
      const messageData = {
        chat_id: chatId,
        sender_id: userId, // Use test user ID
        message_text: input,
        message_type: 'text'
      };
      
      console.log('Sending message:', messageData);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Test data for message sending
      const response = {
        data: {
          success: true,
          message: 'Message sent successfully',
          data: {
            id: Math.floor(Math.random() * 10000) + 100,
            message_text: messageData.message_text,
            sender_id: messageData.sender_id,
            sent_at: new Date().toISOString(),
            status: 'delivered'
          }
        }
      };
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
              status: 'delivered'
            };
          }
          return updatedMessages;
        });
      } else {
        // Remove temporary message if sending failed
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        console.log('Failed to send message:', response.data.message);
      }
    } catch (error) {
      // Remove temporary message if sending failed
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      console.log('Error sending message:', error);
    }
  };

  const renderMessage = ({ item }) => (
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
        <TouchableOpacity style={styles.iconButton}>
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
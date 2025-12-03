import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import Header from '../components/Header';

export default function ChatDetailScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { contactName, contactPhone } = route.params || {};
  
  const [messages, setMessages] = useState([
    { id: 1, text: 'Салом', time: '09:26', isMe: false },
    { id: 2, text: 'Как дела?', time: '09:26', isMe: false },
    { id: 3, text: 'Салом', time: '09:26', isMe: true },
    { id: 4, text: 'Хорошо', time: '09:26', isMe: true },
    { id: 5, text: 'Тест', time: '09:27', isMe: true },
    { id: 6, text: 'Текст', time: '09:28', isMe: true },
  ]);

  const [input, setInput] = useState('');

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages(prev => [
      ...prev,
      {
        id: Date.now(),
        text: input,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true,
      },
    ]);
    setInput('');
  };

  const renderMessage = ({ item }) => (
    <View
      style={[
        styles.messageContainer,
        item.isMe ? styles.myMessage : styles.otherMessage,
        { backgroundColor: item.isMe ? theme.primary : theme.cardBackground },
      ]}
    >
      <Text style={[styles.messageText, { color: item.isMe ? theme.buttonText : theme.text }]}>
        {item.text}
      </Text>
      <Text style={[styles.time, { color: item.isMe ? theme.buttonTextSecondary : theme.textSecondary }]}>
        {item.time}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header 
        title={contactName || contactPhone || t('chat')} 
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      {/* Today indicator */}
      <Text style={[styles.centerDate, { color: theme.textSecondary }]}>
        {t('today')}
      </Text>

      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.messagesContainer}
        inverted={false}
      />

      {/* Input area */}
      <View style={[styles.inputRow, { backgroundColor: theme.cardBackground, borderTopColor: theme.border }]}>
        <TouchableOpacity style={styles.attachButton}>
          <Icon name="attach-file" size={24} color={theme.textSecondary} />
        </TouchableOpacity>
        
        <TextInput
          style={[styles.input, { 
            backgroundColor: theme.inputBackground, 
            color: theme.text,
            borderColor: theme.border 
          }]}
          placeholder={t('typeMessage')}
          placeholderTextColor={theme.placeholder}
          value={input}
          onChangeText={setInput}
          multiline={true}
          numberOfLines={1}
          maxHeight={100}
        />
        
        <TouchableOpacity 
          style={[styles.sendBtn, { backgroundColor: input.trim() ? theme.primary : theme.disabled }]} 
          onPress={sendMessage}
          disabled={!input.trim()}
        >
          <Icon name="send" size={20} color={theme.buttonText} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  centerDate: {
    textAlign: 'center',
    marginVertical: 10,
    fontSize: 12,
    fontWeight: '500',
  },

  messagesContainer: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },

  messageContainer: {
    maxWidth: '80%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    marginVertical: 4,
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

  time: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
  },

  attachButton: {
    marginRight: 8,
    marginBottom: 8,
  },

  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 1,
    borderRadius: 20,
    fontSize: 16,
    textAlignVertical: 'center',
  },

  sendBtn: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
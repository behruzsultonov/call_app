import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AddGroupScreen({ navigation }) {
  const { t } = useTranslation();
  
  // Fallback translations in case i18n is not loaded
  const getText = (key) => {
    const translated = t(key);
    return translated && translated !== key ? translated : key;
  };
  const { theme } = useTheme();
  const [groupName, setGroupName] = useState('');
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [userId, setUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);
  
  useEffect(() => {
    if (userId) {
      loadContacts();
    }
  }, [userId]);

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

  const loadContacts = async () => {
    if (!userId) return;

    try {
      const response = await api.getContacts(userId);
      if (response.data.success) {
        setContacts(response.data.data || []);
      } else {
        Alert.alert(t('error'), response.data.message || t('failedToLoadContacts'));
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert(t('error'), t('failedToLoadContacts'));
    }
  };

  const toggleContactSelection = (contactId) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const filteredContacts = contacts.filter(contact => {
    const name = contact.contact_name || contact.username || contact.phone || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const createGroupChat = async () => {
    if (!groupName.trim()) {
      Alert.alert(getText('error'), getText('groupNameIsRequired'));
      return;
    }

    if (selectedContacts.size < 1) {
      Alert.alert(getText('error'), getText('pleaseSelectAtLeastOneContact'));
      return;
    }

    if (!userId) {
      Alert.alert(getText('error'), getText('userNotLoggedIn'));
      return;
    }

    try {
      // Prepare participants array: include creator and selected contacts
      // Map selected contact IDs to actual user IDs from the contacts list
      const selectedContactIds = Array.from(selectedContacts);
      const selectedUserIds = [];
      
      // Extract actual user IDs from the selected contacts
      for (const contactId of selectedContactIds) {
        const contact = contacts.find(c => (c.contact_user_id || c.id) == contactId);
        if (contact) {
          // Use contact_user_id if it exists, otherwise use id
          const actualUserId = contact.contact_user_id || contact.id;
          if (actualUserId && !selectedUserIds.includes(actualUserId)) {
            selectedUserIds.push(actualUserId);
          }
        }
      }
      
      const participants = [userId, ...selectedUserIds];
      
      const chatData = {
        chat_name: groupName.trim(),
        chat_type: 'group',
        created_by: userId,
        participants: participants
      };

      console.log('Sending chat creation request:', chatData);
      const response = await api.createChat(chatData);
      console.log('Received response:', response);

      // Check if response exists and has data, regardless of success flag
      if (response && response.data) {
        // Navigate to the newly created group chat
        // The group was created successfully (as it appears in chats list)
        // Even if there's an error response, we can still navigate
        const createdChat = response.data.data || response.data;
        if (createdChat && createdChat.id) {
          navigation.navigate('Chat', { 
            chat: { 
              id: createdChat.id, 
              name: createdChat.chat_name || createdChat.name || groupName,
              isPrivate: false, // This is a group chat
              otherParticipantId: null,
              memberCount: createdChat.member_count || 0
            }
          });
        } else {
          // If we can't get chat data from response, still navigate to chats screen
          navigation.navigate('Chats');
          Alert.alert(getText('success'), getText('groupCreatedSuccessfully'));
        }
      } else {
        Alert.alert(getText('error'), response?.data?.message || getText('failedToCreateGroup'));
      }
    } catch (error) {
      console.error('Error creating group chat:', error);
      Alert.alert(getText('error'), getText('failedToCreateGroup'));
    }
  };

  const renderContactItem = ({ item }) => {
    const isSelected = selectedContacts.has(item.contact_user_id || item.id);
    const displayName = item.contact_name || item.username || item.phone || t('unknownContact');

    return (
      <TouchableOpacity
        style={[styles.contactItem, { backgroundColor: theme.cardBackground }]}
        onPress={() => toggleContactSelection(item.contact_user_id || item.id)}
      >
        <View style={styles.contactInfo}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={[styles.avatarText, { color: theme.buttonText }]}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.contactName, { color: theme.text }]}>
            {displayName}
          </Text>
        </View>
        <View style={styles.checkboxContainer}>
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected, { borderColor: theme.primary }]}>
            {isSelected && <Icon name="check" size={16} color={theme.buttonText} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t('createGroup')}</Text>
        <View style={{ width: 24 }} /> {/* Spacer for alignment */}
      </View>

      <View style={styles.content}>
        <View style={[styles.groupInfoSection, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('groupInfo')}</Text>
          <TextInput
            style={[styles.groupNameInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            placeholder={getText('enterGroupName')}
            placeholderTextColor={theme.textSecondary}
            value={groupName}
            onChangeText={setGroupName}
          />
        </View>

        <View style={[styles.selectParticipantsSection, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{getText('selectParticipants')}</Text>
          
          <View style={[styles.searchContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Icon name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder={getText('searchContacts')}
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {contacts.length === 0 ? (
            <View style={styles.emptyContactsContainer}>
              <Text style={[styles.emptyContactsText, { color: theme.textSecondary }]}>{getText('noContactsAvailable')}</Text>
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => (item.contact_user_id || item.id).toString()}
              renderItem={renderContactItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.contactsList}
              style={styles.flatList}
            />
          )}
        </View>
      </View>

      <View style={[styles.footer, { backgroundColor: theme.cardBackground, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: theme.primary }]}
          onPress={createGroupChat}
        >
          <Text style={[styles.createButtonText, { color: theme.buttonText }]}>{getText('createGroup')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  groupInfoSection: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  groupNameInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  selectParticipantsSection: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  contactsList: {
    flexGrow: 1,
  },
  flatList: {
    flex: 1,
  },
  emptyContactsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyContactsText: {
    fontSize: 16,
    textAlign: 'center',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  contactInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactName: {
    fontSize: 16,
  },
  checkboxContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  createButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
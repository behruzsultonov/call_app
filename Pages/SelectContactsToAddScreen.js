import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Header from '../components/Header';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SelectContactsToAddScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  const { chatId, currentUserId, existingParticipants = [] } = route?.params || {};
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [showSearch, setShowSearch] = useState(false);

  // Extract existing participant IDs with proper type conversion
  const existingParticipantIds = useMemo(() => {
    const ids = new Set();
    (existingParticipants || []).forEach(p => {
      // Handle various possible field names and normalize to string
      const id = p.user_id ?? p.participant_id ?? p.id ?? p.contact_user_id;
      if (id !== undefined && id !== null) {
        ids.add(String(id));
      }
    });
    return ids;
  }, [existingParticipants]);

  useEffect(() => {
    loadContacts();
  }, [existingParticipants]); // Added dependency on existingParticipants

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = contacts.filter(contact => 
        contact.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts(contacts);
    }
  }, [searchQuery, contacts]);

  const loadContacts = async () => {
    if (!currentUserId) return;

    try {
      setLoading(true);

      // Get user's contacts from the API
      const response = await api.getContacts(currentUserId);
      
      if (response.data.success) {
        // Process all contacts, marking existing participants differently
        const allContacts = (response.data.data || [])
          .filter(contact => 
            String(contact.contact_user_id) !== String(currentUserId) // Don't include current user
          )
          .map(contact => ({
            id: contact.contact_user_id,
            name: contact.contact_name || contact.name || `User ${contact.contact_user_id}`,
            phone: contact.contact_phone || contact.phone || '',
            username: contact.contact_name || contact.name || `User ${contact.contact_user_id}`,
            isExistingParticipant: existingParticipantIds.has(String(contact.contact_user_id)),
          }));

        setContacts(allContacts);
        setFilteredContacts(allContacts);
      } else {
        Alert.alert(t('error'), response.data.message || t('failedToLoadContacts'));
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert(t('error'), t('failedToLoadContacts'));
    } finally {
      setLoading(false);
    }
  };

  const toggleContactSelection = (contactId) => {
    // Don't allow selection of existing participants
    if (existingParticipantIds.has(String(contactId))) {
      return;
    }
    
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const addSelectedContacts = async () => {
    if (selectedContacts.size === 0) {
      Alert.alert(t('noSelection'), t('pleaseSelectAtLeastOneContactToAdd'));
      return;
    }

    try {
      const selectedContactArray = Array.from(selectedContacts);
      
      // Add each selected contact to the group
      for (const contactId of selectedContactArray) {
        const response = await api.addParticipant({
          chat_id: chatId,
          user_id: currentUserId, // Current user making the request
          participant_id: contactId // The participant to add
        });

        if (!response.data.success) {
          throw new Error(response.data.message || t('failedToAddParticipant'));
        }
      }

      Alert.alert(t('success'), `${selectedContactArray.length} ${t('contactPlural')} ${t('addedToGroupSuccessfully')}.`);
      
      // Navigate back to GroupInfoScreen with a refresh flag
      navigation.goBack();
    } catch (error) {
      console.error('Error adding participants:', error);
      Alert.alert(t('error'), error.message || t('failedToAddParticipantsToGroup'));
    }
  };

  const renderContactItem = ({ item }) => {
    const isSelected = selectedContacts.has(item.id) && !item.isExistingParticipant;
    const isDisabled = item.isExistingParticipant;
    
    return (
      <TouchableOpacity
        style={[
          styles.contactItem, 
          { backgroundColor: theme.cardBackground, borderColor: theme.border },
          isDisabled && styles.disabledContactItem
        ]}
        onPress={() => !isDisabled && toggleContactSelection(item.id)}
        disabled={isDisabled}
      >
        <View style={styles.contactInfo}>
          <View style={[
            styles.avatar, 
            { backgroundColor: isDisabled ? '#ccc' : theme.primary }
          ]}>
            <Text style={[styles.avatarText, { color: theme.buttonText }]}>
              {item.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.contactDetails}>
            <Text style={[styles.contactName, { color: isDisabled ? '#aaa' : theme.text }]} numberOfLines={1} ellipsizeMode="tail">
              {item.name}
            </Text>
            <Text style={[styles.contactPhone, { color: isDisabled ? '#aaa' : theme.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
              {item.phone}
            </Text>
            {isDisabled && (
              <Text style={[styles.existingParticipantText, { color: '#FF6B6B' }]}>
                {t('alreadyInGroup')}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.checkboxContainer}>
          {isDisabled ? (
            <View style={[styles.existingParticipantIndicator, { borderColor: '#FF6B6B' }]}>
              <Icon name="done" size={16} color="#FF6B6B" />
            </View>
          ) : (
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected, { borderColor: theme.primary }]}>
              {isSelected && <Icon name="check" size={16} color={theme.buttonText} />}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header 
        title={t('selectContactsToAdd')}
        showSearch={true}
        searchVisible={showSearch}
        onSearchPress={setShowSearch}
        searchValue={searchQuery}
        onSearchChange={handleSearch}
        onBack={() => navigation.goBack()}
        rightButton={
          <TouchableOpacity onPress={addSelectedContacts}>
            <Text style={[styles.headerButton, { color: theme.primary }]}>
              {t('add')} ({selectedContacts.size})
            </Text>
          </TouchableOpacity>
        }
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={{ color: theme.text }}>{t('loadingContacts')}</Text>
        </View>
      ) : (
        <>
          {filteredContacts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {contacts.length === 0 ? t('noContactsAvailable') : t('noContactsMatchSearch')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderContactItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.contactsList}
            />
          )}
        </>
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
  contactsList: {
    padding: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  disabledContactItem: {
    opacity: 0.6,
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
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
  },
  contactPhone: {
    fontSize: 14,
    marginTop: 2,
  },
  existingParticipantText: {
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  checkboxContainer: {
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#D88A22',
  },
  existingParticipantIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  headerButton: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
});
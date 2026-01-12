import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Header from '../components/Header';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

export default function ContactsScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [blockedContacts, setBlockedContacts] = useState(new Set());
  
  const normalizePhone = (p) => (p || '').toString().replace(/[^\d+]/g, '');

  const normalizeRegular = (c) => ({
    ...c,
    is_blocked: false,
    contact_user_id: c.contact_user_id ?? c.user_id ?? c.id_user ?? c.contactId,
    contact_phone: normalizePhone(c.contact_phone ?? c.phone),
    contact_name: c.contact_name ?? c.name,
  });

  const normalizeBlocked = (c) => ({
    ...c,
    is_blocked: true,

    // ВАЖНО: приводим поля blocked -> contact_*
    contact_user_id: c.contact_user_id ?? c.blocked_user_id ?? c.blocked_id ?? c.user_id,
    contact_phone: normalizePhone(
      c.contact_phone ?? c.blocked_phone_number ?? c.blocked_phone ?? c.phone
    ),
    contact_name: c.contact_name ?? c.blocked_username ?? c.name,
  });

  const makeKey = (c) => {
    const uid = c.contact_user_id;
    if (uid !== undefined && uid !== null && String(uid).trim() !== '') return `uid:${uid}`;
    if (c.contact_phone) return `phone:${c.contact_phone}`;
    return `id:${c.id}`;
  };
  
  useEffect(() => {
    loadUserData();
  }, []);
  
  useEffect(() => {
    if (userId) {
      loadContacts();
    }
  }, [userId]);
  
  // Refresh contacts when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadContacts();
      }
      
      // Check if we need to refresh from route params
      if (route?.params?.refresh) {
        loadContacts();
        // Reset the param so we don't keep refreshing
        navigation.setParams({ refresh: false });
      }
    }, [userId, route?.params?.refresh])
  );
  
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
  
  const loadContacts = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      const [regularResponse, blockedResponse] = await Promise.all([
        api.getContacts(userId),
        api.getBlockedContacts(userId),
      ]);

    const map = new Map();

    // 1) regular
    if (regularResponse?.data?.success) {
      (regularResponse.data.data || [])
        .map(normalizeRegular)
        .forEach((c) => {
          map.set(makeKey(c), c);
        });
    }

    // 2) blocked (приоритет!)
    if (blockedResponse?.data?.success) {
      const blockedList = (blockedResponse.data.data || []).map(normalizeBlocked);

      blockedList.forEach((b) => {
        const key = makeKey(b);
        const existing = map.get(key);

        map.set(key, {
          ...(existing || {}),
          ...b,
          is_blocked: true, // гарантируем приоритет blocked
        });
      });

      setBlockedContacts(new Set(blockedList.map((x) => x.contact_user_id).filter(Boolean)));
    } else {
      setBlockedContacts(new Set());
    }

    const merged = Array.from(map.values());
    setContacts(merged);

    if (searchQuery) applySearchFilter(searchQuery, merged);
    else setFilteredContacts(merged);
  } catch (e) {
    console.error('Error loading contacts:', e);
    setContacts([]);
    setFilteredContacts([]);
  } finally {
    setLoading(false);
  }
};
  

  
  const handleLongPressContact = (contact) => {
    // Check if this contact is blocked
    const isContactBlocked = contact.is_blocked || blockedContacts.has(contact.contact_user_id);
    
    const options = [
      {
        text: t('cancel'),
        style: 'cancel'
      },
      {
        text: isContactBlocked ? t('unblockContact') : t('blockContact'),
        onPress: () => {
          if (isContactBlocked) {
            // Confirm unblocking
            Alert.alert(
              t('unblockContact'),
              t('confirmUnblockContact'),
              [
                { text: t('cancel'), style: 'cancel' },
                { text: t('unblock'), onPress: () => unblockContact(contact.id) }
              ]
            );
          } else {
            // Confirm blocking
            Alert.alert(
              t('blockContact'),
              t('confirmBlockContact'),
              [
                { text: t('cancel'), style: 'cancel' },
                { text: t('block'), onPress: () => blockContact(contact.id) }
              ]
            );
          }
        },
        style: isContactBlocked ? 'default' : 'destructive'
      },
      {
        text: t('delete'),
        onPress: () => deleteContact(contact.id),
        style: 'destructive'
      }
    ];
    
    Alert.alert(
      t('contactOptions'),
      t('selectContactAction'),
      options,
      { cancelable: true }
    );
  };
  
  const deleteContact = async (contactId) => {
    if (!userId) return;
    
    try {
      const response = await api.deleteContact({
        contact_id: contactId // This is now the correct contact record ID
      });
      
      if (response.data.success) {
        // Remove the contact from the list
        setContacts(prevContacts => prevContacts.filter(contact => contact.id !== contactId));
        // Update filtered contacts as well
        setFilteredContacts(prevContacts => prevContacts.filter(contact => contact.id !== contactId));
        console.log('Contact deleted successfully');
      } else {
        console.log('Failed to delete contact:', response.data.message);
        Alert.alert(t('error'), response.data.message || t('failedToDeleteContact'));
      }
    } catch (error) {
      console.log('Error deleting contact:', error);
      Alert.alert(t('error'), t('failedToDeleteContact'));
    }
  };
  
  const blockContact = async (contactId) => {
    if (!userId) return;
    
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;
      
      const response = await api.blockContact({
        user_id: userId,
        blocked_user_id: contact.contact_user_id,
        blocked_phone: contact.contact_phone
      });
      
      if (response.data.success) {
        // Update the contact to mark it as blocked
        setContacts(prevContacts => 
          prevContacts.map(c => 
            c.id === contactId ? { ...c, is_blocked: true } : c
          )
        );
        setFilteredContacts(prevContacts => 
          prevContacts.map(c => 
            c.id === contactId ? { ...c, is_blocked: true } : c
          )
        );
        // Update blocked contacts set
        setBlockedContacts(prev => new Set([...prev, contact.contact_user_id]));
        console.log('Contact blocked successfully');
        Alert.alert(t('success'), t('contactBlockedSuccessfully'));
      } else {
        console.log('Failed to block contact:', response.data.message);
        Alert.alert(t('error'), response.data.message || t('failedToBlockContact'));
      }
    } catch (error) {
      console.log('Error blocking contact:', error);
      Alert.alert(t('error'), t('failedToBlockContact'));
    }
  };
  
  const unblockContact = async (contactId) => {
    if (!userId) return;
    
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;
      
      const response = await api.unblockContact({
        user_id: userId,
        blocked_user_id: contact.contact_user_id,
        blocked_phone: contact.contact_phone
      });
      
      if (response.data.success) {
        // Update the contact to mark it as unblocked
        setContacts(prevContacts => 
          prevContacts.map(c => 
            c.id === contactId ? { ...c, is_blocked: false } : c
          )
        );
        setFilteredContacts(prevContacts => 
          prevContacts.map(c => 
            c.id === contactId ? { ...c, is_blocked: false } : c
          )
        );
        // Update blocked contacts set
        setBlockedContacts(prev => {
          const newSet = new Set(prev);
          newSet.delete(contact.contact_user_id);
          return newSet;
        });
        console.log('Contact unblocked successfully');
        Alert.alert(t('success'), t('contactUnblockedSuccessfully'));
      } else {
        console.log('Failed to unblock contact:', response.data.message);
        Alert.alert(t('error'), response.data.message || t('failedToUnblockContact'));
      }
    } catch (error) {
      console.log('Error unblocking contact:', error);
      Alert.alert(t('error'), t('failedToUnblockContact'));
    }
  };
  
  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (query.trim() === '') {
      // If search query is empty, show all contacts
      setFilteredContacts(contacts);
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    
    try {
      const response = await api.searchContacts(userId, query);
      
      if (response.data.success) {
        const list = (response.data.data || []).map((c) => {
          // search может отдавать как regular-форму — нормализуем
          const n = normalizeRegular(c);
          return { ...n, is_blocked: blockedContacts.has(n.contact_user_id) || n.is_blocked };
        });

        // дедуп внутри поиска
        const m = new Map();
        list.forEach((c) => m.set(makeKey(c), c));
        setFilteredContacts(Array.from(m.values()));
      } else {
        setFilteredContacts([]);
      }
    } catch (error) {
      console.error('Error searching contacts:', error);
      setFilteredContacts([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  const applySearchFilter = (query, contactsList) => {
    if (!query.trim()) {
      setFilteredContacts(contactsList);
      return;
    }
    
    const lowerQuery = query.toLowerCase();
    const filtered = contactsList.filter(contact =>
      (contact.contact_name || '').toLowerCase().includes(lowerQuery) ||
      (contact.contact_phone || '').toLowerCase().includes(lowerQuery)
    );
    
    setFilteredContacts(filtered);
  };

  const renderContactItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.contactItem,
        { 
          borderBottomColor: theme.border,
          backgroundColor: theme.cardBackground
        }
      ]}
      onPress={() => {
        // Navigate to ContactInfo screen with contact data
        navigation.navigate('ContactInfo', {
          contact: {
            id: item.id, // This is the actual contact record ID
            contact_user_id: item.contact_user_id, // This is the user ID of the contact
            name: item.contact_name,
            phone: item.contact_phone,
            status: 'green' // Default status, could be enhanced later
          }
        });
      }}
      onLongPress={() => handleLongPressContact(item)}
    >
      <View style={[styles.avatar, { backgroundColor: theme.primary }]}> 
        <Text style={[styles.avatarText, { color: theme.buttonText }]}>{item.contact_name ? item.contact_name.charAt(0) : '?'}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: theme.text }]}>{item.contact_name}</Text>
        <Text style={[styles.contactPhone, { color: theme.textSecondary }]}>{item.contact_phone}</Text>
      </View>
      {item.is_blocked ? (
        <Icon name="lock" size={20} color="#FF6B6B" />
      ) : item.is_favorite === 1 ? (
        <Icon name="star" size={20} color="#FFD700" />
      ) : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header 
        title={t('contacts')} 
        showSearch={true} 
        searchVisible={showSearch}
        onSearchPress={setShowSearch}
        searchValue={searchQuery}
        onSearchChange={handleSearch}
        onBack={() => navigation.goBack()}
      />
      
      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => makeKey(item)}
        renderItem={renderContactItem}
        contentContainerStyle={styles.contactList}
        onRefresh={loadContacts}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {t('noContactsYet')}
            </Text>
          </View>
        }
      />
      
      {/* Floating Action Button for adding contacts */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => navigation.navigate('AddContact')}
      >
        <Icon name="add" size={24} color={theme.buttonText} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contactList: {
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
  contactItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
  },
  contactPhone: {
    fontSize: 14,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyText: {
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
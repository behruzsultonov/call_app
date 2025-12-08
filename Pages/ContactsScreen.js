import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Header from '../components/Header';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ContactsScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  
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
      console.log('ContactsScreen: Starting to load user data from AsyncStorage...');
      
      const userDataString = await AsyncStorage.getItem('userData');
      console.log('ContactsScreen: Raw userDataString from AsyncStorage:', userDataString);
      
      const authToken = await AsyncStorage.getItem('authToken');
      console.log('ContactsScreen: Raw authToken from AsyncStorage:', authToken);
      
      if (userDataString && authToken) {
        const user = JSON.parse(userDataString);
        console.log('ContactsScreen: Parsed user data:', user);
        setUserId(user.id);
      } else {
        console.log('ContactsScreen: Missing userData or authToken');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };
  
  const loadContacts = async () => {
    if (!userId) {
      console.log('ContactsScreen: No user ID, skipping loadContacts');
      return;
    }
    
    console.log('Loading contacts for user ID:', userId);
    try {
      setLoading(true);
      console.log('ContactsScreen: Making API call to get contacts for user ID:', userId);
      
      const response = await api.getContacts(userId);
      
      console.log('ContactsScreen: Received response from getContacts:', response);
      
      if (response.data.success) {
        setContacts(response.data.data || []);
      } else {
        console.log('Failed to load contacts:', response.data.message);
        setContacts([]);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
        config: error.config,
        request: error.request
      });
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };
  
  const navigateToChat = async (contact) => {
    try {
      // First, try to find an existing chat with this contact
      // For now, we'll create a new chat with the contact
      const chatData = {
        chat_name: contact.contact_name,
        chat_type: 'private',
        created_by: userId,
        participants: [userId, contact.contact_user_id]
      };
      
      const response = await api.createChat(chatData);
      
      if (response.data.success) {
        // Navigate to the newly created chat
        navigation.navigate('Chat', { 
          chat: { id: response.data.data.id, name: contact.contact_name }
        });
      } else {
        Alert.alert(t('error'), response.data.message || t('failedToCreateChat'));
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      Alert.alert(t('error'), t('failedToCreateChat'));
    }
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
      onPress={() => navigateToChat(item)}
    >
      <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
        <Text style={[styles.avatarText, { color: theme.buttonText }]}>{item.contact_name.charAt(0)}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: theme.text }]}>{item.contact_name}</Text>
        <Text style={[styles.contactPhone, { color: theme.textSecondary }]}>{item.contact_phone}</Text>
      </View>
      {item.is_favorite === 1 && (
        <Icon name="star" size={20} color="#FFD700" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header 
        title={t('contacts')} 
        showSearch={true} 
      />
      
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id.toString()}
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
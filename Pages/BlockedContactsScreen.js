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

export default function BlockedContactsScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  const [blockedContacts, setBlockedContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (userId) {
      loadBlockedContacts();
    }
  }, [userId]);

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

  const loadBlockedContacts = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const response = await api.getBlockedContacts(userId);
      
      if (response.data.success) {
        // Transform blocked contacts to match the expected format
        const formattedContacts = (response.data.data || []).map(contact => ({
          id: contact.id,
          contact_user_id: contact.blocked_user_id,
          contact_name: contact.blocked_username || contact.blocked_phone_number,
          contact_phone: contact.blocked_phone_number || contact.blocked_phone,
          blocked_at: contact.blocked_at
        }));
        
        setBlockedContacts(formattedContacts);
      } else {
        console.log('Failed to load blocked contacts:', response.data.message);
        setBlockedContacts([]);
      }
    } catch (error) {
      console.error('Error loading blocked contacts:', error);
      setBlockedContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const unblockContact = async (contactId) => {
    if (!userId) return;
    
    try {
      const contact = blockedContacts.find(c => c.id === contactId);
      if (!contact) return;

      const response = await api.unblockContact({
        user_id: userId,
        blocked_user_id: contact.contact_user_id,
        blocked_phone: contact.contact_phone
      });

      if (response.data.success) {
        // Remove the contact from the list
        setBlockedContacts(prevContacts => prevContacts.filter(c => c.id !== contactId));
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

  const handleLongPressContact = (contact) => {
    Alert.alert(
      t('unblockContact'),
      t('confirmUnblockContact'),
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('unblock'), 
          onPress: () => unblockContact(contact.id),
          style: 'destructive'
        }
      ],
      { cancelable: true }
    );
  };

  const renderBlockedContactItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.contactItem,
        { 
          borderBottomColor: theme.border,
          backgroundColor: theme.cardBackground
        }
      ]}
      onLongPress={() => handleLongPressContact(item)}
    >
      <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
        <Text style={[styles.avatarText, { color: theme.buttonText }]}>
          {item.contact_name ? item.contact_name.charAt(0) : '?'}
        </Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: theme.text }]}>{item.contact_name}</Text>
        <Text style={[styles.contactPhone, { color: theme.textSecondary }]}>{item.contact_phone}</Text>
      </View>
      <View style={styles.contactMeta}>
        <Text style={[styles.contactTime, { color: theme.textSecondary }]}>
          {item.blocked_at ? new Date(item.blocked_at).toLocaleDateString() : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header 
        title={t('blockedContacts')} 
        onBack={() => navigation.goBack()}
      />
      
      <FlatList
        data={blockedContacts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderBlockedContactItem}
        contentContainerStyle={styles.contactList}
        onRefresh={loadBlockedContacts}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {t('noBlockedContacts')}
            </Text>
          </View>
        }
      />
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
  contactMeta: {
    alignItems: 'flex-end',
  },
  contactTime: {
    fontSize: 12,
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
});
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '../components/Header';

export default function ContactInfoScreen({ navigation }) {
  const route = useRoute();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { contact } = route.params || {};
  
  const [contactData, setContactData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  
  // Default contact data if none provided (for direct navigation)
  const displayContact = contactData || contact || {
    name: 'Jane Smith',
    phone: '+992 98 558 0777',
    status: 'green'
  };

  useEffect(() => {
    loadUserData();
    
    if (contact && contact.id && !contact.phone) {
      loadContactDetails(contact.id);
    } else if (contact) {
      setContactData(contact);
    }
  }, [contact]);

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

  const loadContactDetails = async (contactId) => {
    try {
      setLoading(true);
      // Fetch contact details from API
      const response = await api.getUser(contactId);
      
      if (response.data.success && response.data.data) {
        const userData = response.data.data;
        setContactData({
          name: userData.username || contact.name,
          phone: userData.phone_number || contact.phone || '+992 98 558 0777',
          status: contact.status || 'green',
          id: contactId,
          contact_user_id: contact.contact_user_id || contactId // Preserve the contact_user_id
        });
      }
    } catch (error) {
      console.error('Error loading contact details:', error);
      // Fallback to provided contact data
      setContactData(contact);
    } finally {
      setLoading(false);
    }
  };

  const createChatWithContact = async () => {
    // Use the contact_user_id instead of id for chat operations
    const contactUserId = displayContact.contact_user_id || displayContact.id;
    
    if (!userId || !contactUserId) {
      Alert.alert('Error', 'Unable to create chat. Missing user or contact information.');
      return;
    }

    try {
      // First, check if a private chat already exists with this contact
      const checkResponse = await api.checkPrivateChat(userId, contactUserId);
      
      if (checkResponse.data.success) {
        // An existing chat was found, navigate to it
        const existingChat = checkResponse.data.data;
        navigation.navigate('Chat', { 
          chat: { 
            id: existingChat.id, 
            name: displayContact.name,
            isPrivate: true,
            otherParticipantId: contactUserId
          }
        });
      } else {
        // No existing chat found, create a new one
        const chatData = {
          chat_name: displayContact.name,
          chat_type: 'private',
          created_by: userId,
          participants: [userId, contactUserId]
        };
        
        const response = await api.createChat(chatData);
        
        if (response.data.success) {
          // Navigate to the newly created chat
          navigation.navigate('Chat', { 
            chat: { 
              id: response.data.data.id, 
              name: displayContact.name,
              isPrivate: true,
              otherParticipantId: contactUserId
            }
          });
        } else {
          Alert.alert('Error', response.data.message || 'Failed to create chat');
        }
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      Alert.alert('Error', 'Failed to create chat');
    }
  };

  const deleteContact = async () => {
    if (!userId || !displayContact.id) {
      Alert.alert('Error', 'Unable to delete contact. Missing user or contact information.');
      return;
    }

    Alert.alert(
      t('deleteContact'),
      t('deleteContactConfirmation'),
      [
        {
          text: t('cancel'),
          style: 'cancel'
        },
        {
          text: t('delete'),
          onPress: async () => {
            try {
              // Delete the contact using the contact record ID
              const response = await api.deleteContact({
                contact_id: displayContact.id // This is now the correct contact record ID
              });
              
              if (response.data.success) {
                // Navigate back to contacts screen
                navigation.goBack();
                Alert.alert(t('success'), t('contactDeleted'));
              } else {
                Alert.alert('Error', response.data.message || t('failedToDeleteContact'));
              }
            } catch (error) {
              console.error('Error deleting contact:', error);
              Alert.alert('Error', t('failedToDeleteContact'));
            }
          },
          style: 'destructive'
        }
      ],
      { cancelable: true }
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header
        title={displayContact.name}
        onBack={() => navigation.goBack()}
        rightButton={
          <TouchableOpacity onPress={deleteContact}>
            <Icon name="more-vert" size={24} color={theme.primary} />
          </TouchableOpacity>
        }
      />

      {/* Avatar + Info + Actions - Combined in one block */}
      <View style={[styles.block, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        {/* Center part - Avatar without green circle */}
        <View style={styles.center}>
          <View style={[styles.avatar, { backgroundColor: theme.success }]}>
            <Icon name="person" size={60} color={theme.buttonText} />
            {/* Removed the green status circle */}
          </View>

          {/* Show name instead of phone number here */}
          <Text style={[styles.phone, { color: theme.text }]}>{displayContact.name}</Text>
          <Text style={[styles.timeAgo, { color: theme.textSecondary }]}>1 min. ago</Text>
        </View>

        {/* Actions with circular backgrounds */}
        <View style={[styles.actionsRow, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.actionItem}>
            <TouchableOpacity onPress={createChatWithContact}>
              <View style={[styles.circularActionIcon, { backgroundColor: "#fdf1e4" }]}>
                <Icon name="chat-bubble" size={28} color="#e88a17" />
              </View>
            </TouchableOpacity>
            <Text style={[styles.actionLabel, { color: theme.primary }]}>{t('chat')}</Text>
          </View>

          <View style={styles.actionItem}>
            <TouchableOpacity>
              <View style={[styles.circularActionIcon, { backgroundColor: "#fdf1e4" }]}>
                <Icon name="call" size={28} color="#e88a17" />
              </View>
            </TouchableOpacity>
            <Text style={[styles.actionLabel, { color: theme.primary }]}>{t('call')}</Text>
          </View>

          <View style={styles.actionItem}>
            <TouchableOpacity>
              <View style={[styles.circularActionIcon, { backgroundColor: "#fdf1e4" }]}>
                <Icon name="videocam" size={28} color="#e88a17" />
              </View>
            </TouchableOpacity>
            <Text style={[styles.actionLabel, { color: theme.primary }]}>{t('video')}</Text>
          </View>
        </View>
      </View>

      {/* Main info block with phone number below text */}
      <View style={[styles.block, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <View style={styles.infoItem}>
          <Text style={[styles.infoLabel, { color: theme.text }]}>{t('phone')}</Text>
        </View>
        <Text style={[styles.phoneNumber, { color: theme.primary }]}>{displayContact.phone}</Text>
      </View>

      {/* Shared media and notifications block without arrows */}
      <View style={[styles.block, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.border }]}>
          <Text style={[styles.menuText, { color: theme.text }]}>{t('sharedMedia')}</Text>
        </TouchableOpacity>
        
        <View style={[styles.separator, { borderBottomColor: theme.border }]} />
        
        <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.border }]}>
          <Text style={[styles.menuText, { color: theme.text }]}>{t('notifications')}</Text>
        </TouchableOpacity>
      </View>

      {/* Block User and Delete Contact - Combined block without icons */}
      <View style={[styles.block, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <TouchableOpacity style={[styles.dangerItem, { borderBottomColor: theme.border }]}>
          <Text style={[styles.dangerText, { color: theme.error }]}>{t('blockUser')}</Text>
        </TouchableOpacity>
        
        <View style={[styles.separator, { borderBottomColor: theme.border }]} />
        
        <TouchableOpacity 
          style={[styles.dangerItem, { borderBottomColor: theme.border }]}
          onPress={deleteContact}
        >
          <Text style={[styles.dangerText, { color: theme.error }]}>{t('deleteContact')}</Text>
        </TouchableOpacity>
      </View>
      
      {/* Add bottom padding to create space at the end of the scroll view */}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3eef5",
  },


  block: {
    backgroundColor: "#fff",
    marginTop: 12,
    marginHorizontal: 15,
    borderRadius: 10,
    overflow: "hidden",
    // Add shadow for Android
    elevation: 3,
    // Add shadow for iOS
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },

  center: {
    alignItems: "center",
    marginTop: 20,
    padding: 15,
  },

  avatar: {
    width: 110,
    height: 110,
    backgroundColor: "#9ccc65",
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  statusCircle: {
    width: 25,
    height: 25,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: "#fff",
    position: "absolute",
    bottom: 4,
    right: 8,
  },

  phone: {
    fontSize: 19,
    fontWeight: "600",
    marginTop: 12,
    color: "#000",
  },

  timeAgo: {
    fontSize: 14,
    color: "#7b7b7b",
    marginTop: 3,
  },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 22,
    backgroundColor: "#fff",
    paddingVertical: 15,
    paddingHorizontal: 15,
  },

  actionItem: {
    alignItems: "center",
  },

  circularActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fdf1e4", // Light orange with transparency
    justifyContent: "center",
    alignItems: "center",
  },

  actionLabel: {
    marginTop: 4,
    color: "#e88a17",
    fontSize: 13,
  },

  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 15,
  },

  infoLabel: {
    fontSize: 16,
    flex: 1,
  },

  phoneNumber: {
    fontSize: 16,
    color: "#e88a17",
    paddingHorizontal: 15,
    paddingBottom: 15,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 15,
  },

  menuText: {
    fontSize: 16,
    flex: 1,
  },

  dangerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 15,
  },

  dangerText: {
    fontSize: 16,
    fontWeight: "600",
  },

  separator: {
    height: 1,
    borderBottomWidth: 1,
    marginHorizontal: 15,
  },
});
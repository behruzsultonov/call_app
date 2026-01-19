// GroupInfoScreen.js
import React, { useMemo, useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../components/Header';
import { useTranslation } from 'react-i18next';
import api from '../services/Client';

export default function GroupInfoScreen({ route, navigation }) {
  const { t } = useTranslation();

  const {
    chatId,
    chatName,
    participants = [],
    currentUserId,
    memberCount,
    onBack = () => {},
    onEdit = () => {},
    onAddPerson = () => {},
    onDeleteGroup = () => {},
  } = route?.params || {};

  const [loadedParticipants, setLoadedParticipants] = useState(participants);
  const [userContacts, setUserContacts] = useState({}); // Store user's contacts by user ID

  // Load user's contacts to get saved contact names
  useEffect(() => {
    const loadUserContacts = async () => {
      if (!currentUserId) return;
      
      try {
        const response = await api.getContacts(currentUserId);
        if (response.data.success && response.data.data) {
          // Create a map of contact_user_id to contact_name
          const contactsMap = {};
          response.data.data.forEach(contact => {
            if (contact.contact_user_id) {
              contactsMap[contact.contact_user_id] = contact.contact_name || contact.name || `User ${contact.contact_user_id}`;
            }
          });
          setUserContacts(contactsMap);
        }
      } catch (error) {
        console.error('Error loading user contacts in GroupInfoScreen:', error);
      }
    };
    
    loadUserContacts();
  }, [currentUserId]);

  // Load participants if not provided initially
  useEffect(() => {
    const loadParticipantsIfNeeded = async () => {
      if (!participants || participants.length === 0) {
        try {
          const response = await api.getChats(currentUserId);
          if (response.data.success && response.data.data) {
            const currentChat = response.data.data.find(c => String(c.id) === String(chatId));
            if (currentChat && currentChat.participants) {
              setLoadedParticipants(currentChat.participants);
            }
          }
        } catch (error) {
          console.error('Error loading participants in GroupInfoScreen:', error);
        }
      }
    };

    loadParticipantsIfNeeded();
  }, [chatId, currentUserId, participants]);
  
  // Refresh participants when screen comes back into focus
  useFocusEffect(
    React.useCallback(() => {
      const refreshOnFocus = async () => {
        try {
          const response = await api.getChats(currentUserId);
          if (response.data.success && response.data.data) {
            const currentChat = response.data.data.find(c => String(c.id) === String(chatId));
            if (currentChat && currentChat.participants) {
              setLoadedParticipants(currentChat.participants);
            }
          }
        } catch (error) {
          console.error('Error refreshing participants on focus in GroupInfoScreen:', error);
        }
      };
      
      refreshOnFocus();
      
      // Clean up function
      return () => {};
    }, [chatId, currentUserId])
  );

  const members = useMemo(() => {
    const participantsToUse = loadedParticipants.length > 0 ? loadedParticipants : participants;
    return (participantsToUse || []).map(p => {
      const isCurrentUser = String(p.id) === String(currentUserId);
      // Use contact name from user's contacts if available, otherwise use participant name
      const contactName = userContacts[p.id];
      const displayName = contactName || p.username || p.name || `User ${p.id}`;
      return {
        id: p.id,
        name: displayName,
        subtitle: p.joined_at ? `${t('joined')}: ${new Date(p.joined_at).toLocaleDateString()}` : t('active'),
        role: p.is_admin ? t('admin') : t('member'),
        color: isCurrentUser ? '#4CB6A5' : '#7DC46C',
      };
    });
  }, [loadedParticipants, participants, currentUserId, userContacts]);

  const membersCount = memberCount ?? (loadedParticipants.length > 0 ? loadedParticipants.length : members.length);
  
  const deleteGroup = async () => {
    Alert.alert(
      t('deleteGroup'),
      t('deleteGroupConfirmation', { groupName: chatName }),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.deleteChat({
                chat_id: chatId,
                user_id: currentUserId,
                delete_for_everyone: true // Delete for all participants
              });
              
              if (response.data.success) {
                Alert.alert(t('success'), t('groupDeletedSuccessfully'));
                // Navigate back to Chats tab
                navigation.navigate('MainTabs', { screen: 'Chats' });
              } else {
                Alert.alert(t('error'), response.data.message || t('failedToDeleteGroup'));
              }
            } catch (error) {
              console.error('Error deleting group:', error);
              Alert.alert(t('error'), t('failedToDeleteGroup'));
            }
          },
        },
      ],
      { cancelable: true }
    );
  };
  
  const addPerson = async () => {
    // Navigate to contact selection screen to add participants
    navigation.navigate('SelectContactsToAdd', {
      chatId,
      currentUserId,
      existingParticipants: loadedParticipants,
    });
  };
  
  // Function to refresh participants list
  const refreshParticipants = async () => {
    try {
      const response = await api.getChats(currentUserId);
      if (response.data.success && response.data.data) {
        const currentChat = response.data.data.find(c => String(c.id) === String(chatId));
        if (currentChat && currentChat.participants) {
          setLoadedParticipants(currentChat.participants);
        }
      }
    } catch (error) {
      console.error('Error refreshing participants in GroupInfoScreen:', error);
    }
  };
  
  const Avatar = ({ label, color }) => (
    <View style={[styles.avatar, { backgroundColor: color }]}>
      <Text style={styles.avatarText}>{label}</Text>
    </View>
  );

  const TopGroupCard = () => (
    <View style={[styles.card, styles.groupCard]}>
      <Avatar label={(chatName?.[0] || 'G').toUpperCase()} color="#6B78C8" />
      <View style={{ flex: 1 }}>
        <Text style={styles.groupTitle}>{chatName}</Text>
        <Text style={styles.groupSubtitle}>{membersCount} {t('members')}</Text>
      </View>
    </View>
  );

  const SettingsCard = () => (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.rowTitle}>{t('notifications')}</Text>
        <Text style={styles.rowValue}>{t('enabled')}</Text>
      </View>
      <View style={styles.divider} />
      <View>
        <Text style={styles.rowTitle}>{t('media')}</Text>
        <Text style={styles.rowSubValue}>{t('itemsCount', { count: 0 })}</Text>
      </View>
    </View>
  );

  const MembersCard = () => (
    <View style={styles.card}>
      <TouchableOpacity style={styles.addPersonRow} activeOpacity={0.8} onPress={addPerson}>
        <View style={styles.addPersonIconBox}>
          <Text style={styles.addPersonIcon}>👤</Text>
        </View>
        <Text style={styles.addPersonText}>{t('addPerson')}</Text>
      </TouchableOpacity>
      <View style={styles.divider} />

      {members.map((m, idx) => (
        <View key={m.id}>
          <View style={styles.memberRow}>
            <Avatar label={(m.name?.[0] || 'U').toUpperCase()} color={m.color || '#999'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{m.name}</Text>
              <Text style={styles.memberSub}>{m.subtitle}</Text>
            </View>
            <Text style={styles.memberRole}>{m.role}</Text>
          </View>
          {idx !== members.length - 1 && <View style={styles.memberDivider} />}
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Header 
        title={t('groupInfo')} 
        onBack={() => navigation.goBack()} 
      />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <TopGroupCard />
        <SettingsCard />
        <MembersCard />
        <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.85} onPress={deleteGroup}>
          <Text style={styles.deleteText}>{t('deleteGroup')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const ORANGE = '#F39C12';
const BG = '#F2F3F5';
const CARD = '#FFFFFF';
const TEXT = '#222';
const MUTED = '#8B8B8B';
const LINE = '#E7E7E7';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  header: {
    height: 56,
    paddingHorizontal: 14,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcon: { fontSize: 20, color: ORANGE },
  headerTitle: { fontSize: 18, fontWeight: '700', color: ORANGE },

  container: {
    padding: 14,
    paddingBottom: 28,
    gap: 14,
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupTitle: { fontSize: 18, fontWeight: '800', color: ORANGE },
  groupSubtitle: { marginTop: 2, fontSize: 14, color: MUTED },

  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: { fontSize: 16, color: TEXT, fontWeight: '500' },
  rowValue: { fontSize: 16, color: MUTED, fontWeight: '500' },
  rowSubValue: { marginTop: 2, fontSize: 14, color: MUTED },

  divider: {
    height: 1,
    backgroundColor: LINE,
    marginVertical: 12,
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontWeight: '800', fontSize: 18 },

  addPersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  addPersonIconBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#E9F2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPersonIcon: { fontSize: 18 },
  addPersonText: { fontSize: 16, fontWeight: '600', color: ORANGE },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  memberName: { fontSize: 16, fontWeight: '700', color: TEXT },
  memberSub: { marginTop: 2, fontSize: 13, color: MUTED },
  memberRole: { fontSize: 13, color: MUTED, fontWeight: '600' },
  memberDivider: { height: 1, backgroundColor: LINE, marginLeft: 58 },

  deleteBtn: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  deleteText: { color: '#E74C3C', fontSize: 16, fontWeight: '700' },
});
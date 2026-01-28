// ChannelInfoScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../components/Header';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function ChannelInfoScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const { channel } = route?.params || {};
  const [userId, setUserId] = useState(null);
  const [channelData, setChannelData] = useState(channel);
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(channel?.is_subscribed || false);
  const [isOwner, setIsOwner] = useState(false);
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAvatar, setEditAvatar] = useState(null);

  // Load user ID
  useEffect(() => {
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

    loadUserData();
  }, []);

  // Check ownership
  useEffect(() => {
    if (userId && channelData?.owner_id) {
      setIsOwner(parseInt(userId) === parseInt(channelData.owner_id));
    }
  }, [userId, channelData]);

  // Initialize edit form when editing starts
  useEffect(() => {
    if (isEditing) {
      setEditTitle(channelData?.title || '');
      setEditDescription(channelData?.description || '');
      setEditAvatar(channelData?.avatar_url || null);
    }
  }, [isEditing, channelData]);

  // Load channel details and subscribers
  const loadChannelData = useCallback(async () => {
    if (!channel?.id || !userId) return;

    setLoading(true);
    try {
      // Get channel details
      const response = await api.getChannelById(channel.id);
      console.log('[CHANNEL INFO] Channel data response:', response.data);
      
      if (response.data.success && response.data.data) {
        const fullChannelData = response.data.data;
        console.log('[CHANNEL INFO] Full channel data:', fullChannelData);
        setChannelData(fullChannelData);
        setIsSubscribed(fullChannelData.is_subscribed || false);
        setIsOwner(parseInt(fullChannelData.owner_id) === parseInt(userId));
      }

      // Get subscribers list
      const subscribersResponse = await api.getChannelSubscribers(channel.id);
      if (subscribersResponse.data.success) {
        setSubscribers(subscribersResponse.data.data || []);
      }
    } catch (error) {
      console.error('Error loading channel data:', error);
    } finally {
      setLoading(false);
    }
  }, [channel?.id, userId]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadChannelData();
    }, [loadChannelData])
  );

  // Start editing
  const startEditing = () => {
    setIsEditing(true);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setEditTitle('');
    setEditDescription('');
    setEditAvatar(null);
  };

  // Save changes
  const saveChanges = async () => {
    if (!channelData?.id) return;

    try {
      const updateData = {
        channel_id: channelData.id,
        title: editTitle.trim(),
        description: editDescription.trim(),
      };

      // If avatar was changed, we would need to handle file upload here
      // For now, we'll just update title and description

      const response = await api.updateChannel(updateData);
      if (response.data.success) {
        Alert.alert(t('success'), t('channelUpdatedSuccessfully'));
        setIsEditing(false);
        // Reload channel data to reflect changes
        loadChannelData();
      } else {
        Alert.alert(t('error'), response.data.message || t('failedToUpdateChannel'));
      }
    } catch (error) {
      console.error('Error updating channel:', error);
      Alert.alert(t('error'), t('failedToUpdateChannel'));
    }
  };

  // Select new avatar
  const selectAvatar = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel || response.error) {
        console.log('Image picker cancelled or error:', response.error);
        return;
      }

      if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        setEditAvatar(asset.uri);
      }
    });
  };

  // Subscribe/Unsubscribe
  const toggleSubscription = async () => {
    if (!channelData?.id || !userId) return;

    try {
      if (isSubscribed) {
        // Unsubscribe
        const response = await api.unsubscribeFromChannel(channelData.id);
        if (response.data.success) {
          setIsSubscribed(false);
          Alert.alert(t('success'), t('unsubscribedSuccessfully'));
          loadChannelData(); // Refresh data
        } else {
          Alert.alert(t('error'), response.data.message || t('failedToUnsubscribe'));
        }
      } else {
        // Subscribe
        const response = await api.subscribeToChannel(channelData.id);
        if (response.data.success) {
          setIsSubscribed(true);
          Alert.alert(t('success'), t('subscribedSuccessfully'));
          loadChannelData(); // Refresh data
        } else {
          Alert.alert(t('error'), response.data.message || t('failedToSubscribe'));
        }
      }
    } catch (error) {
      console.error('Error toggling subscription:', error);
      Alert.alert(t('error'), t('networkError'));
    }
  };

  // Delete channel (owner only)
  const deleteChannel = () => {
    if (!isOwner) return;

    Alert.alert(
      t('deleteChannel'),
      t('deleteChannelConfirmation'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.deleteChannel({ channel_id: channelData.id });
              if (response.data.success) {
                Alert.alert(t('success'), t('channelDeletedSuccessfully'));
                // Navigate to ChatsScreen after successful deletion
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'MainTabs', params: { screen: 'Chats' } }],
                });
              } else {
                Alert.alert(t('error'), response.data.message || t('failedToDeleteChannel'));
              }
            } catch (error) {
              console.error('Error deleting channel:', error);
              Alert.alert(t('error'), t('failedToDeleteChannel'));
            }
          },
        },
      ]
    );
  };

  // Render channel info card
  const renderChannelInfo = () => (
    <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.channelHeader}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Text style={styles.avatarText}>
            {channelData?.title?.charAt(0).toUpperCase() || 'C'}
          </Text>
        </View>
        <View style={styles.channelInfo}>
          <Text style={[styles.channelTitle, { color: theme.primary }]}>
            {channelData?.title || 'Unknown Channel'}
          </Text>
          <Text style={[styles.channelSubtitle, { color: theme.textSecondary }]}>
            @{channelData?.username || 'unknown'}
          </Text>
          <Text style={[styles.channelSubtitle, { color: theme.textSecondary }]}>
            {channelData?.subscriber_count ?? subscribers.length} {t('subscribers')}
          </Text>
        </View>
      </View>

      {channelData?.description ? (
        <View style={styles.descriptionContainer}>
          <Text style={[styles.descriptionTitle, { color: theme.text }]}>{t('description')}</Text>
          <Text style={[styles.descriptionText, { color: theme.textSecondary }]}>
            {channelData.description}
          </Text>
        </View>
      ) : null}
    </View>
  );

  // Render subscription button
  const renderSubscriptionButton = () => {
    if (isOwner) return null; // Owner can't subscribe/unsubscribe

    return (
      <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
        <TouchableOpacity
          style={[styles.subscriptionButton, { backgroundColor: isSubscribed ? '#E74C3C' : theme.primary }]}
          onPress={toggleSubscription}
          disabled={loading}
        >
          <Text style={styles.subscriptionButtonText}>
            {isSubscribed ? t('unsubscribe') : t('subscribe')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render subscribers list
  const renderSubscribers = () => (
    <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('subscribers')}</Text>
      {subscribers.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t('noSubscribers')}</Text>
      ) : (
        subscribers.map((subscriber, index) => (
          <View key={subscriber.id}>
            <View style={styles.subscriberRow}>
              <View style={[styles.avatar, { backgroundColor: theme.primary, width: 40, height: 40 }]}>
                <Text style={[styles.avatarText, { fontSize: 16 }]}>
                  {subscriber.username?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <View style={styles.subscriberInfo}>
                <Text style={[styles.subscriberName, { color: theme.text }]}>
                  {subscriber.username || `User ${subscriber.id}`}
                </Text>
                {subscriber.joined_at && (
                  <Text style={[styles.subscriberDate, { color: theme.textSecondary }]}>
                    {t('joined')} {new Date(subscriber.joined_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
              {parseInt(subscriber.id) === parseInt(channelData?.owner_id) && (
                <Text style={[styles.ownerBadge, { color: theme.primary }]}>{t('owner')}</Text>
              )}
            </View>
            {index < subscribers.length - 1 && (
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
            )}
          </View>
        ))
      )}
    </View>
  );

  // Render delete button (owner only)
  const renderDeleteButton = () => {
    if (!isOwner) return null;

    return (
      <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: theme.cardBackground }]}
          onPress={deleteChannel}
        >
          <Text style={[styles.deleteButtonText, { color: '#E74C3C' }]}>{t('deleteChannel')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render edit modal
  const renderEditModal = () => (
    <Modal
      visible={isEditing}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <Header
          title={t('editChannel')}
          onBack={cancelEditing}
          rightButton={
            <TouchableOpacity onPress={saveChanges}>
              <Text style={[styles.saveButton, { color: theme.primary }]}>{t('save')}</Text>
            </TouchableOpacity>
          }
        />

        <ScrollView
          contentContainerStyle={styles.editContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar section */}
          <View style={[styles.avatarSection, { backgroundColor: theme.cardBackground }]}>
            <TouchableOpacity onPress={selectAvatar}>
              {editAvatar ? (
                <Image source={{ uri: editAvatar }} style={styles.editAvatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                  <Text style={styles.avatarPlaceholderText}>
                    {editTitle?.charAt(0).toUpperCase() || 'C'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={selectAvatar} style={styles.changeAvatarButton}>
              <Text style={[styles.changeAvatarText, { color: theme.primary }]}>
                {t('changeAvatar')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Title input */}
          <View style={[styles.inputSection, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>{t('channelName')}</Text>
            <TextInput
              style={[styles.input, { 
                color: theme.text,
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              }]}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder={t('enterChannelName')}
              placeholderTextColor={theme.textSecondary}
              maxLength={100}
            />
          </View>

          {/* Description input */}
          <View style={[styles.inputSection, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>{t('description')}</Text>
            <TextInput
              style={[styles.textArea, { 
                color: theme.text,
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              }]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder={t('enterChannelDescription')}
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header
        title={t('channelInfo')}
        onBack={() => navigation.goBack()}
        rightButton={
          isOwner ? (
            <TouchableOpacity onPress={startEditing}>
              <Icon name="edit" size={24} color={theme.primary} />
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {renderChannelInfo()}
        {renderSubscriptionButton()}
        {isOwner && renderSubscribers()}
        {renderDeleteButton()}
      </ScrollView>

      {renderEditModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 24,
  },
  channelInfo: {
    flex: 1,
  },
  channelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  channelSubtitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  descriptionContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  subscriptionButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  subscriptionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subscriberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  subscriberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  subscriberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  subscriberDate: {
    fontSize: 13,
  },
  ownerBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  divider: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 52,
  },
  deleteButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  editContent: {
    padding: 16,
    gap: 16,
  },
  avatarSection: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  editAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: 'bold',
  },
  changeAvatarButton: {
    marginTop: 12,
  },
  changeAvatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  inputSection: {
    borderRadius: 12,
    padding: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 14,
  },
});
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const MySubscriptionsScreen = () => {
  const navigation = useNavigation();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSubscribedChannels();
  }, []);

  const loadSubscribedChannels = async () => {
    try {
      const response = await api.getMySubscribedChannels();

      if (response.data.success) {
        setChannels(response.data.data);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to load subscribed channels');
      }
    } catch (error) {
      console.error('Error loading subscribed channels:', error);
      Alert.alert('Error', 'Failed to load subscribed channels');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSubscribedChannels();
  };

  const unsubscribeFromChannel = async (channelId) => {
    Alert.alert(
      'Confirm Unsubscribe',
      'Are you sure you want to unsubscribe from this channel?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unsubscribe',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.unsubscribeFromChannel(channelId);

              if (response.data.success) {
                Alert.alert('Success', 'Successfully unsubscribed from channel');
                // Refresh the channel list
                loadSubscribedChannels();
              } else {
                Alert.alert('Error', response.data.message || 'Failed to unsubscribe');
              }
            } catch (error) {
              console.error('Error unsubscribing from channel:', error);
              Alert.alert('Error', 'Failed to unsubscribe from channel');
            }
          }
        }
      ]
    );
  };

  const renderChannel = ({ item }) => (
    <TouchableOpacity
      style={styles.channelCard}
      onPress={() => navigation.navigate('ChannelView', { channelId: item.id })}
    >
      <View style={styles.channelHeader}>
        {item.avatar_url ? (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.title.charAt(0).toUpperCase()}
            </Text>
          </View>
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.title.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.channelInfo}>
          <Text style={styles.channelTitle}>{item.title}</Text>
          <Text style={styles.channelUsername}>@{item.username}</Text>
          <Text style={styles.subscriberCount}>
            {item.subscriber_count || 0} subscribers
          </Text>
          {item.last_post_date && (
            <Text style={styles.lastPostDate}>
              Last post: {new Date(item.last_post_date).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.channelActions}>
        <TouchableOpacity
          style={styles.unsubscribeButton}
          onPress={() => unsubscribeFromChannel(item.id)}
        >
          <Text style={styles.unsubscribeButtonText}>Unsubscribe</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Subscriptions</Text>
        <Text style={styles.headerSubtitle}>
          {channels.length} {channels.length === 1 ? 'channel' : 'channels'} subscribed
        </Text>
      </View>
      
      <FlatList
        data={channels}
        renderItem={renderChannel}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
  },
  channelCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  channelHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  channelInfo: {
    flex: 1,
  },
  channelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  channelUsername: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  subscriberCount: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  lastPostDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  channelActions: {
    marginLeft: 12,
  },
  unsubscribeButton: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  unsubscribeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default MySubscriptionsScreen;
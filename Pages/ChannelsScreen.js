import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const ChannelsScreen = () => {
  const navigation = useNavigation();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredChannels, setFilteredChannels] = useState([]);

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    // Filter channels based on search query
    if (searchQuery.trim() === '') {
      setFilteredChannels(channels);
    } else {
      const filtered = channels.filter(channel =>
        channel.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        channel.username.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredChannels(filtered);
    }
  }, [searchQuery, channels]);

  const loadChannels = async () => {
    try {
      const response = await api.getChannels();
      
      if (response.data.success) {
        setChannels(response.data.data);
        setFilteredChannels(response.data.data);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to load channels');
      }
    } catch (error) {
      console.error('Error loading channels:', error);
      Alert.alert('Error', 'Failed to load channels');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadChannels();
  };

  const subscribeToChannel = async (channelId) => {
    try {
      const response = await api.subscribeToChannel(channelId);

      if (response.data.success) {
        Alert.alert('Success', 'Successfully subscribed to channel');
        // Refresh the channel list
        loadChannels();
      } else {
        Alert.alert('Error', response.data.message || 'Failed to subscribe');
      }
    } catch (error) {
      console.error('Error subscribing to channel:', error);
      Alert.alert('Error', 'Failed to subscribe to channel');
    }
  };

  const renderChannel = ({ item }) => (
    <TouchableOpacity
      style={styles.channelCard}
      onPress={async () => {
        try {
          // Fetch the full channel details before navigating
          const response = await api.getChannelById(item.id);
          if (response.data.success && response.data.data) {
            navigation.navigate('ChannelView', { channel: response.data.data });
          } else {
            // Fallback to just the ID if detailed fetch fails
            navigation.navigate('ChannelView', { channel: item });
          }
        } catch (error) {
          console.error('Error fetching channel details:', error);
          // Navigate with the available item data
          navigation.navigate('ChannelView', { channel: item });
        }
      }}
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
        </View>
      </View>
      <View style={styles.channelActions}>
        <TouchableOpacity
          style={[
            styles.subscribeButton,
            item.is_subscribed && styles.subscribedButton,
          ]}
          onPress={() => subscribeToChannel(item.id)}
        >
          <Text style={styles.subscribeButtonText}>
            {item.is_subscribed ? 'Subscribed' : 'Subscribe'}
          </Text>
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
        <TextInput
          style={styles.searchInput}
          placeholder="Search channels..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.createChannelButton}
          onPress={() => navigation.navigate('CreateChannel')}
        >
          <Text style={styles.createChannelButtonText}>Create Channel</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={filteredChannels}
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
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  createChannelButton: {
    backgroundColor: '#34C759',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  createChannelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
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
    alignItems: 'center',
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
  channelActions: {
    marginLeft: 12,
  },
  subscribeButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  subscribedButton: {
    backgroundColor: '#ccc',
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ChannelsScreen;
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  SafeAreaView,
} from 'react-native';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import Header from '../components/Header';

const CreateChannelScreen = () => {
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  const [loading, setLoading] = useState(false);

  const selectAvatar = async () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 500,
      maxHeight: 500,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel || response.error) {
        return;
      }

      if (response.assets && response.assets[0]) {
        setAvatarUri(response.assets[0].uri);
      }
    });
  };

  const uploadAvatar = async (uri) => {
    const formData = new FormData();
    formData.append('file', {
      uri: uri,
      type: 'image/jpeg',
      name: `channel_avatar_${Date.now()}.jpg`,
    });

    try {
      const response = await api.uploadImage(formData);
      if (response.data.success) {
        return response.data.file_url;
      } else {
        throw new Error(response.data.message || 'Avatar upload failed');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      throw error;
    }
  };

  const createChannel = async () => {
    // Validate inputs
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a channel title');
      return;
    }
    
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username for your channel');
      return;
    }
    
    // Validate username format
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      Alert.alert('Error', 'Username can only contain letters, numbers, and underscores');
      return;
    }

    setLoading(true);

    try {
      let avatarUrl = null;
      
      // Upload avatar if selected
      if (avatarUri) {
        avatarUrl = await uploadAvatar(avatarUri);
      }

      // Create channel
      const response = await api.createChannel({
        title: title.trim(),
        description: description.trim(),
        username: username.trim(),
        avatar_url: avatarUrl,
      });

      if (response.data.success) {
        Alert.alert('Success', 'Channel created successfully!', [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to the new channel view
              navigation.replace('ChannelView', { channelId: response.data.data.id });
            },
          },
        ]);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to create channel');
      }
    } catch (error) {
      console.error('Create channel error:', error);
      Alert.alert('Error', 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Create Channel"
        onBack={() => navigation.goBack()}
      />
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.form}>
          {/* Channel Title */}
          <Text style={styles.label}>Channel Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter channel title"
            maxLength={100}
          />

          {/* Username */}
          <Text style={styles.label}>Username *</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username (a-z, 0-9, _ only)"
            maxLength={50}
          />
          <Text style={styles.hint}>Unique identifier for your channel (e.g., @mychannel)</Text>

          {/* Description */}
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your channel..."
            multiline
            textAlignVertical="top"
            numberOfLines={4}
            maxLength={500}
          />

          {/* Avatar */}
          <Text style={styles.label}>Avatar (Optional)</Text>
          {avatarUri ? (
            <View style={styles.avatarContainer}>
              <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
              <TouchableOpacity
                style={styles.removeAvatarButton}
                onPress={() => setAvatarUri(null)}
              >
                <Text style={styles.removeAvatarText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.avatarButton} onPress={selectAvatar}>
              <Text style={styles.avatarButtonText}>Select Avatar Image</Text>
            </TouchableOpacity>
          )}

          {/* Create Button */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={[styles.createButton, loading && styles.disabledButton]}
              onPress={createChannel}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>Create Channel</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    backgroundColor: '#f5f5f5',
  },
  form: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  avatarButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  avatarButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatarPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 8,
  },
  removeAvatarButton: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  removeAvatarText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  bottomContainer: {
    marginTop: 32,
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CreateChannelScreen;
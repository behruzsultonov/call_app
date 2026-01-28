import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';

const CreatePostScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { channelId } = route.params;

  const [text, setText] = useState('');
  const [mediaUri, setMediaUri] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [uploading, setUploading] = useState(false);

  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs access to your storage to pick images/videos.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const selectMedia = async () => {
    const permissionGranted = await requestStoragePermission();
    if (!permissionGranted) {
      Alert.alert('Permission Required', 'Storage permission is required to select media.');
      return;
    }

    const options = {
      mediaType: 'mixed', // Allows both images and videos
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel || response.error) {
        console.log('Image picker cancelled or error:', response.error);
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setMediaUri(asset.uri);
        setMediaType(asset.type.startsWith('image') ? 'image' : 'video');
      }
    });
  };

  const captureMedia = async () => {
    const permissionGranted = await requestStoragePermission();
    if (!permissionGranted) {
      Alert.alert('Permission Required', 'Storage permission is required to capture media.');
      return;
    }

    const options = {
      mediaType: 'mixed',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
    };

    launchCamera(options, (response) => {
      if (response.didCancel || response.error) {
        console.log('Camera cancelled or error:', response.error);
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setMediaUri(asset.uri);
        setMediaType(asset.type.startsWith('image') ? 'image' : 'video');
      }
    });
  };

  const uploadMedia = async (uri, type) => {
    const formData = new FormData();
    formData.append('file', {
      uri: uri,
      type: type,
      name: `channel_post_${Date.now()}.${type.split('/')[1]}`,
    });

    try {
      const response = await api.uploadImage(formData);

      if (response.data.success) {
        return response.data.file_url;
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const createPost = async () => {
    if (!text.trim() && !mediaUri) {
      Alert.alert('Error', 'Please enter some text or select media for your post.');
      return;
    }

    setUploading(true);

    try {
      let mediaUrl = null;
      if (mediaUri) {
        mediaUrl = await uploadMedia(mediaUri, mediaType);
      }

      const response = await api.createChannelPost({
        channel_id: channelId,
        text: text.trim(),
        media_type: mediaUri ? (mediaType.includes('image') ? 'image' : 'video') : 'none',
        media_url: mediaUrl,
      });

      if (response.data.success) {
        Alert.alert('Success', 'Post created successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to create post');
      }
    } catch (error) {
      console.error('Create post error:', error);
      Alert.alert('Error', 'Failed to create post');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Write your post here..."
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
        />
      </View>

      {mediaUri && (
        <View style={styles.mediaPreviewContainer}>
          <Image source={{ uri: mediaUri }} style={styles.mediaPreview} />
          <TouchableOpacity
            style={styles.removeMediaButton}
            onPress={() => {
              setMediaUri(null);
              setMediaType(null);
            }}
          >
            <Text style={styles.removeMediaText}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.mediaButton} onPress={selectMedia}>
          <Text style={styles.mediaButtonText}>Choose Media</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.cameraButton} onPress={captureMedia}>
          <Text style={styles.cameraButtonText}>Take Photo/Video</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.postButton, uploading && styles.disabledButton]}
          onPress={createPost}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.postButtonText}>Publish Post</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  textInput: {
    minHeight: 200,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  mediaPreviewContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    padding: 8,
    alignItems: 'center',
  },
  mediaPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removeMediaButton: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  removeMediaText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  mediaButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  mediaButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cameraButton: {
    flex: 1,
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cameraButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  bottomContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  postButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  postButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CreatePostScreen;
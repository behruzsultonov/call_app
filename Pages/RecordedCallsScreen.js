import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import Header from '../components/Header';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Sound from 'react-native-nitro-sound'; // Import for audio playback
import { getAuthToken } from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

// Use Node.js server URL directly for recordings - should be configured based on environment
// In a real app, this would come from a config file or environment variable
const NODE_SERVER_URL = 'http://34.179.130.224:3500'; // Change this to your actual Node.js server URL

const RecordedCallsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [recordings, setRecordings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playingRecording, setPlayingRecording] = useState(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [downloadLoading, setDownloadLoading] = useState({});
  const downloadedFilesRef = useRef(new Set());

  // Load recordings when component mounts
  useEffect(() => {
    loadRecordings();
    return () => {
      // Clean up any playing audio when component unmounts
      if (playingRecording !== null) {
        try {
          Sound.stopPlayer();
          Sound.removePlayBackListener();
          Sound.removePlaybackEndListener();
          // Clean up the currently playing recording's file
          cleanupDownloadedFile(playingRecording.name);
        } catch (error) {
          console.log('Error cleaning up audio playback:', error);
        }
      }
      
      // Clean up all downloaded files when component unmounts
      downloadedFilesRef.current.forEach(fileName => {
        cleanupDownloadedFile(fileName);
      });
    };
  }, []);

  // Load all recorded calls from Node.js server
  const loadRecordings = async () => {
    try {
      setLoading(true);
      
      // Get user ID from storage
      const userDataString = await AsyncStorage.getItem('userData');
      if (!userDataString) {
        Alert.alert(t('error'), t('notLoggedIn'));
        return;
      }
      
      const userData = JSON.parse(userDataString);
      const userId = userData.id;
      if (!userId) {
        Alert.alert(t('error'), t('notLoggedIn'));
        return;
      }
      
      const response = await fetch(`${NODE_SERVER_URL}/api/recordings`, {
        method: 'GET',
        headers: {
          'X-User-Id': userId,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Transform server data to match expected format
        const transformedRecordings = data.items.map((item, index) => ({
          id: `${item.name}_${index}`, // Create unique ID
          name: item.name,
          url: `${NODE_SERVER_URL}${item.url}`, // Full URL for playback
          size: item.size,
          date: new Date(item.mtime * 1000), // Convert timestamp to date
          mtime: item.mtime,
        })).sort((a, b) => b.mtime - a.mtime); // Sort by date, newest first
        
        setRecordings(transformedRecordings);
      } else {
        Alert.alert(t('error'), data.message || t('failedToLoadRecordings'));
      }
    } catch (error) {
      console.error('Error loading recordings:', error);
      Alert.alert(t('error'), t('failedToLoadRecordings'));
    } finally {
      setLoading(false);
    }
  };

  // Refresh recordings
  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecordings();
    setRefreshing(false);
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format duration from file size (approximation)
  const formatDuration = (bytes) => {
    // Rough approximation: 16 kbps AAC ~ 1 KB per second
    const seconds = Math.floor(bytes / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Play/pause recording
  const togglePlayback = async (recording) => {
    try {
      // If this is the same recording that's currently playing, pause it
      if (playingRecording && playingRecording.id === recording.id) {
        await Sound.pausePlayer();
        setPlayingRecording(null);
        return;
      }
      
      // If another recording is playing, stop it first and clean up
      if (playingRecording !== null && playingRecording.id !== recording.id) {
        await Sound.stopPlayer();
        Sound.removePlayBackListener();
        Sound.removePlaybackEndListener();
        // Clean up the previously playing recording's file using the original name
        cleanupDownloadedFile(playingRecording.name);
      }
      
      // Log the URL for debugging
      console.log('Attempting to play recording URL:', recording.url);
      
      // Define fileName first
      const fileName = recording.name;
      
      // Download the file first before playing
      // Get user ID (same as in loadRecordings)
      const userDataString = await AsyncStorage.getItem('userData');
      const userData = JSON.parse(userDataString);
      const userId = userData.id;
      
      // Use CachesDirectoryPath (internal) - more stable and reliable
      const downloadDest = `${RNFS.CachesDirectoryPath}/${fileName}`;
      
      // Ensure the directory exists
      try {
        await RNFS.mkdir(RNFS.CachesDirectoryPath);
      } catch (mkdirError) {
        console.log('Directory already exists or error creating:', mkdirError);
      }
      
      // Check if file already exists locally, if not download it
      const fileExists = await RNFS.exists(downloadDest);
      if (!fileExists) {
        // Show download loading indicator only when actually downloading
        setDownloadLoading(prev => ({ ...prev, [recording.id]: true }));
        
        console.log('Downloading file:', downloadDest);
        
        const download = RNFS.downloadFile({
          fromUrl: recording.url,
          toFile: downloadDest,
          headers: {
            'X-User-Id': String(userId),
          },
          progressDivider: 10,
        });
        
        const res = await download.promise;
        
        // IMPORTANT: verify that the file was actually downloaded
        console.log('Download result:', res);
        
        if (res.statusCode !== 200) {
          // Hide download loading indicator on error
          setDownloadLoading(prev => ({ ...prev, [recording.id]: false }));
          throw new Error(`Download failed. statusCode=${res.statusCode}`);
        }
        if (!res.bytesWritten || res.bytesWritten <= 0) {
          // Hide download loading indicator on error
          setDownloadLoading(prev => ({ ...prev, [recording.id]: false }));
          throw new Error(`Download failed. bytesWritten=${res.bytesWritten}`);
        }
        
        const finalExists = await RNFS.exists(downloadDest);
        if (!finalExists) {
          // Hide download loading indicator on error
          setDownloadLoading(prev => ({ ...prev, [recording.id]: false }));
          throw new Error(`Downloaded file missing: ${downloadDest}`);
        }
        
        console.log('Download completed:', downloadDest);
        // Track that this file has been downloaded
        downloadedFilesRef.current.add(recording.name);
        // Hide download loading indicator
        setDownloadLoading(prev => ({ ...prev, [recording.id]: false }));
      } else {
        console.log('File already exists locally:', downloadDest);
        // Track that this file exists
        downloadedFilesRef.current.add(recording.name);
        // No need to show loading indicator since file already exists
      }
      
      // The file should exist at this point since we verified it after download
      // Verify file is not empty and is accessible
      try {
        const statResult = await RNFS.stat(downloadDest);
        if (parseInt(statResult.size) === 0) {
          throw new Error(`Downloaded file is empty: ${downloadDest}`);
        }
        console.log('File size:', statResult.size, 'bytes');
      } catch (statError) {
        console.error('Error getting file stats:', statError);
        throw new Error(`Could not access downloaded file: ${downloadDest}`);
      }
      
      // Set up playback progress listener
      Sound.addPlayBackListener((e) => {
        // Update progress (0-100)
        const progress = e.duration > 0 ? (e.currentPosition / e.duration) * 100 : 0;
        setAudioProgress(progress);
      });
      
      // Add playback end listener to reset state when playback completes
      Sound.addPlaybackEndListener(() => {
        setPlayingRecording(null);
        setAudioProgress(0);
        Sound.removePlayBackListener();
        Sound.removePlaybackEndListener();
        // Don't clean up the downloaded file after normal playback completion
        // File will be cleaned up when component unmounts or when switching to another recording
      });
      
      // Start playback with the local file path
      // Ensure downloadDest is not null or undefined
      if (!downloadDest) {
        throw new Error('Download destination path is null or undefined');
      }
      
      // Try with file:// prefix for Android
      const result = await Sound.startPlayer(`file://${downloadDest}`);
      console.log('Playback started:', result);
      
      // Mark this recording as playing
      setPlayingRecording(recording);
    } catch (error) {
      console.error('Error playing recording:', error);
      // Use recording.url as fallback since downloadDest might not be in scope in error handler
      console.error('File path attempted:', recording.url);
      // More robust error handling to avoid null parameter issues
      try {
        Alert.alert(t('error'), t('failedToPlayAudio'));
      } catch (alertError) {
        console.error('Error showing alert:', alertError);
      }
      setPlayingRecording(null);
      // Hide download loading indicator
      setDownloadLoading(prev => ({ ...prev, [recording.id]: false }));
      // Clean up the downloaded file if there was an error using the original name
      try {
        await cleanupDownloadedFile(recording.name);
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
    }
  };

  // Stop playback
  const stopPlayback = async () => {
    try {
      if (playingRecording !== null) {
        await Sound.stopPlayer();
        Sound.removePlayBackListener();
        Sound.removePlaybackEndListener();
        setPlayingRecording(null);
        setAudioProgress(0);
        // Hide download loading indicator if it was showing
        setDownloadLoading(prev => ({ ...prev, [playingRecording.id]: false }));
      }
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  };
  
  // Clean up downloaded file
  const cleanupDownloadedFile = async (fileName) => {
    try {
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      const fileExists = await RNFS.exists(filePath);
      if (fileExists) {
        await RNFS.unlink(filePath);
        console.log('Cleaned up downloaded file:', filePath);
        // Remove from downloaded files set
        downloadedFilesRef.current.delete(fileName);
      }
    } catch (error) {
      console.warn('Error cleaning up file:', error);
    }
  };

  // Delete recording
  const deleteRecording = async (recording) => {
    Alert.alert(
      t('deleteRecording'),
      t('deleteRecordingConfirmation'),
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
              // Get user ID from storage
              const userDataString = await AsyncStorage.getItem('userData');
              if (!userDataString) {
                Alert.alert(t('error'), t('notLoggedIn'));
                return;
              }
              
              const userData = JSON.parse(userDataString);
              const userId = userData.id;
              if (!userId) {
                Alert.alert(t('error'), t('notLoggedIn'));
                return;
              }
              
              // Call the server endpoint to delete the recording
              const response = await fetch(`${NODE_SERVER_URL}/api/recordings/${encodeURIComponent(recording.name)}`, {
                method: 'DELETE',
                headers: {
                  'X-User-Id': userId,
                  'Content-Type': 'application/json',
                },
              });
              
              const result = await response.json();
              
              if (result.success) {
                // Reload the recordings list
                await loadRecordings();
                Alert.alert(t('success'), t('recordingDeleted'));
              } else {
                console.error('Error deleting recording:', result.message);
                Alert.alert(t('error'), result.message || t('failedToDeleteRecording'));
              }
            } catch (error) {
              console.error('Error deleting recording:', error);
              Alert.alert(t('error'), t('failedToDeleteRecording'));
            }
          },
        },
      ]
    );
  };

  // Render item with progress bar
  const renderItem = ({ item }) => {
    const isPlaying = playingRecording && playingRecording.id === item.id;
    return (
      <View style={[styles.recordingItem, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.recordingInfo}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
            <Icon name="audiotrack" size={20} color={theme.primary} />
          </View>
          <View style={styles.recordingDetails}>
            <Text style={[styles.recordingName, { color: theme.text }]} numberOfLines={1}>
              {item.name.replace('call_', '').replace('.wav', '')}
            </Text>
            <View style={styles.metadataContainer}>
              <Text style={[styles.recordingMeta, { color: theme.textSecondary }]}>
                {formatDate(item.date)}
              </Text>
              <Text style={[styles.recordingMeta, { color: theme.textSecondary }]}>
                •
              </Text>
              <Text style={[styles.recordingMeta, { color: theme.textSecondary }]}>
                {formatFileSize(item.size)}
              </Text>
              <Text style={[styles.recordingMeta, { color: theme.textSecondary }]}>
                •
              </Text>
              <Text style={[styles.recordingMeta, { color: theme.textSecondary }]}>
                {formatDuration(item.size)}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Progress bar */}
        {isPlaying && (
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar, 
                { 
                  width: `${audioProgress}%`,
                  backgroundColor: theme.primary 
                }
              ]} 
            />
          </View>
        )}
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, { flex: 1, justifyContent: 'center' }]}
            onPress={() => togglePlayback(item)}
            disabled={downloadLoading[item.id]}
          >
            <View style={styles.mainActionButton}>
              {downloadLoading[item.id] ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon 
                    name={isPlaying ? "pause" : "play-arrow"} 
                    size={20} 
                    color="#FFFFFF" 
                  />
                  <Text style={styles.actionButtonText}>
                    {isPlaying ? t('pause') : t('play')}
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => deleteRecording(item)}
          >
            <Icon 
              name="delete" 
              size={20} 
              color={theme.error || '#FF5252'} 
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Show loading indicator if still loading
  if (loading && recordings.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header 
          title={t('recordedCalls')} 
          onBack={() => navigation.goBack()}
        />
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header 
        title={t('recordedCalls')} 
        onBack={() => navigation.goBack()}
      />
      
      {recordings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconContainer, { backgroundColor: theme.cardBackground }]}>
            <Icon name="music-off" size={48} color={theme.textSecondary} />
          </View>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {t('noRecordedCalls')}
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
            {t('recordedCallsWillAppearHere')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={recordings}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
  },
  recordingItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recordingDetails: {
    flex: 1,
  },
  recordingName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingMeta: {
    fontSize: 13,
    marginRight: 4,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  actionButton: {
    padding: 8,
  },
  mainActionButton: {
    flexDirection: 'row',
    backgroundColor: '#4FC3F7',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: '#FFEEEE',
    borderRadius: 8,
    padding: 10,
    marginLeft: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default RecordedCallsScreen;
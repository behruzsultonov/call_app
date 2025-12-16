import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import RNFS from 'react-native-fs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import Header from '../components/Header';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Sound from 'react-native-nitro-sound'; // Import for audio playback

const RecordedCallsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [recordings, setRecordings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [playingRecording, setPlayingRecording] = useState(null);
  const [audioProgress, setAudioProgress] = useState(0);

  // Load recordings when component mounts
  useEffect(() => {
    loadRecordings();
    return () => {
      // Clean up any playing audio when component unmounts
      if (playingRecording !== null) {
        try {
          Sound.stopPlayer();
          Sound.removePlayBackListener();
        } catch (error) {
          console.log('Error cleaning up audio playback:', error);
        }
      }
    };
  }, []);

  // Load all recorded calls
  const loadRecordings = async () => {
    try {
      // Use DocumentDirectoryPath for both platforms to match where recordings are saved
      const recordingsDir = RNFS.DocumentDirectoryPath;

      // Read directory contents
      const files = await RNFS.readDir(recordingsDir);
      
      // Filter for call recordings
      const callRecordings = files
        .filter(file => file.name.startsWith('call_recording_') && file.name.endsWith('.aac'))
        .map(file => ({
          id: file.name,
          name: file.name,
          path: file.path,
          size: file.size,
          date: new Date(file.mtime),
        }))
        .sort((a, b) => b.date - a.date); // Sort by date, newest first

      setRecordings(callRecordings);
    } catch (error) {
      console.error('Error loading recordings:', error);
      Alert.alert(t('error'), t('failedToLoadRecordings'));
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
      
      // If another recording is playing, stop it first
      if (playingRecording !== null) {
        await Sound.stopPlayer();
        Sound.removePlayBackListener();
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
      });
      
      // Start playback
      const result = await Sound.startPlayer(`file://${recording.path}`);
      console.log('Playback started:', result);
      
      // Mark this recording as playing
      setPlayingRecording(recording);
    } catch (error) {
      console.error('Error playing recording:', error);
      Alert.alert(t('error'), t('failedToPlayAudio'));
      setPlayingRecording(null);
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
      }
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  };

  // Delete recording
  const deleteRecording = (recording) => {
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
              await RNFS.unlink(recording.path);
              // If this recording was playing, stop it
              if (playingRecording && playingRecording.id === recording.id) {
                stopPlayback();
              }
              // Reload recordings
              loadRecordings();
              Alert.alert(t('success'), t('recordingDeleted'));
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
              {item.name.replace('call_recording_', '').replace('.aac', '')}
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
          >
            <View style={styles.mainActionButton}>
              <Icon 
                name={isPlaying ? "pause" : "play-arrow"} 
                size={20} 
                color="#FFFFFF" 
              />
              <Text style={styles.actionButtonText}>
                {isPlaying ? t('pause') : t('play')}
              </Text>
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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header 
        title={t('recordedCalls')} 
        onBackPress={() => navigation.goBack()}
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
});

export default RecordedCallsScreen;
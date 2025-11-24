import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  AppState,
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useWebRTC } from '../contexts/WebRTCContext';
import Header from '../components/Header';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

const CallScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const {
    callStatus,
    remoteUserId,
    endCall,
    acceptCall,
    rejectCall,
    toggleMicrophone,
    toggleCamera,
    getLocalStream,
    getRemoteStream,
    isInCall,
    userId,
  } = useWebRTC();

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState(null);
  const [isAccepting, setIsAccepting] = useState(false); // Add state to prevent multiple accepts

  useEffect(() => {
    // Update streams when they change
    const updateStreams = () => {
      const newLocalStream = getLocalStream();
      const newRemoteStream = getRemoteStream();
      
      // Only update state if streams have actually changed
      if (newLocalStream && newLocalStream !== localStream) {
        console.log('Local stream updated:', newLocalStream);
        console.log('Local stream tracks:', newLocalStream ? newLocalStream.getTracks() : 'No local stream');
        setLocalStream(newLocalStream);
      }
      
      if (newRemoteStream && newRemoteStream !== remoteStream) {
        console.log('Remote stream updated:', newRemoteStream);
        console.log('Remote stream tracks:', newRemoteStream ? newRemoteStream.getTracks() : 'No remote stream');
        setRemoteStream(newRemoteStream);
      }
      
      if (newRemoteStream) {
        console.log('Remote stream URL:', newRemoteStream.toURL());
      }
      
      if (newLocalStream) {
        console.log('Local stream URL:', newLocalStream.toURL());
      }
    };

    updateStreams();

    // Set up call timer when connected
    if (callStatus === 'connected') {
      const startTime = Date.now();
      setCallStartTime(startTime);
      
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setCallDuration(elapsed);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [callStatus, getLocalStream, getRemoteStream, localStream, remoteStream]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'background') {
        // App is going to background, end call
        if (isInCall) {
          console.log('App going to background, ending call');
          endCall();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      if (subscription && subscription.remove) {
        subscription.remove();
      }
    };
  }, [isInCall, endCall]);

  // Format call duration
  const formatCallDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle accept call
  const handleAcceptCall = async () => {
    // Prevent multiple accept attempts
    if (isAccepting) {
      console.log('Already accepting call, skipping duplicate request');
      return;
    }
    
    try {
      console.log('Accepting call...');
      setIsAccepting(true);
      await acceptCall();
      console.log('Call accepted successfully');
    } catch (error) {
      console.error('Error accepting call:', error);
      Alert.alert('Error', 'Failed to accept call');
    } finally {
      setIsAccepting(false);
    }
  };

  // Handle reject call
  const handleRejectCall = () => {
    console.log('Rejecting call...');
    rejectCall();
    // Navigate back to calls screen
    navigation.navigate('MainTabs', { screen: 'Calls' });
  };

  // Handle end call
  const handleEndCall = () => {
    console.log('Ending call...');
    endCall();
    // Navigate back to calls screen
    navigation.navigate('MainTabs', { screen: 'Calls' });
  };

  // Handle toggle microphone
  const handleToggleMicrophone = () => {
    console.log('Toggling microphone...');
    const newState = toggleMicrophone();
    setIsMicOn(newState);
  };

  // Handle toggle camera
  const handleToggleCamera = () => {
    console.log('Toggling camera...');
    const newState = toggleCamera();
    setIsCameraOn(newState);
  };

  // Render incoming call screen
  if (callStatus === 'incoming') {
    console.log('Rendering incoming call screen');
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title={t('incomingCall')} />
        
        <View style={styles.content}>
          <Text style={[styles.incomingCallText, { color: theme.text }]}>{t('incomingCall')}</Text>
          <Text style={[styles.userIdText, { color: theme.text }]}>{t('from')}: {remoteUserId}</Text>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton, { backgroundColor: theme.error }]}
              onPress={handleRejectCall}
            >
              <Icon name="call-end" size={30} color={theme.buttonText} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton, { backgroundColor: theme.success }]}
              onPress={handleAcceptCall}
              disabled={isAccepting} // Disable while accepting
            >
              <Icon name="call" size={30} color={theme.buttonText} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Render calling screen
  if (callStatus === 'calling') {
    console.log('Rendering calling screen');
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title={t('calling')} />
        
        <View style={styles.content}>
          <Text style={[styles.callingText, { color: theme.text }]}>{t('calling')}</Text>
          <Text style={[styles.userIdText, { color: theme.text }]}>{remoteUserId}</Text>
          <Text style={[styles.callingSubtext, { color: theme.textSecondary }]}>{t('connecting')}</Text>
          
          <View style={styles.singleActionButton}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton, { backgroundColor: theme.error }]}
              onPress={handleEndCall}
            >
              <Icon name="call-end" size={30} color={theme.buttonText} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Render call in progress screen
  if (callStatus === 'connected') {
    console.log('Rendering connected call screen');
    console.log('Remote stream:', remoteStream);
    console.log('Local stream:', localStream);
    console.log('Remote stream URL:', remoteStream ? remoteStream.toURL() : 'No remote stream');
    console.log('Local stream URL:', localStream ? localStream.toURL() : 'No local stream');
    
    return (
      <View style={[styles.callContainer, { backgroundColor: theme.background }]}>
        {/* Remote video stream */}
        {remoteStream ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
          />
        ) : (
          <View style={[styles.remoteVideoPlaceholder, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.remoteVideoText, { color: theme.text }]}>{t('noVideoFrom')} {remoteUserId}</Text>
            <Text style={[styles.remoteVideoSubtext, { color: theme.textSecondary }]}>{t('checkConnection')}</Text>
          </View>
        )}
        
        {/* Local video stream (picture-in-picture) */}
        {localStream ? (
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            mirror={true}
          />
        ) : (
          <View style={[styles.localVideo, styles.localVideoPlaceholder, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.localVideoText, { color: theme.text }]}>{t('noLocalVideo')}</Text>
          </View>
        )}
        
        {/* Call info */}
        <View style={styles.callInfo}>
          <Text style={[styles.callInfoText, { color: theme.text }]}>{remoteUserId}</Text>
          <Text style={[styles.callDurationText, { color: theme.text }]}>{formatCallDuration(callDuration)}</Text>
        </View>
        
        {/* Call controls */}
        <View style={styles.callControls}>
          <TouchableOpacity
            style={[styles.controlButton, !isMicOn && styles.mutedButton, { backgroundColor: !isMicOn ? theme.error : theme.cardBackground }]}
            onPress={handleToggleMicrophone}
          >
            <Icon 
              name={isMicOn ? "mic" : "mic-off"} 
              size={30} 
              color={isMicOn ? theme.text : theme.buttonText} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.controlButton, !isCameraOn && styles.disabledButton, { backgroundColor: !isCameraOn ? theme.error : theme.cardBackground }]}
            onPress={handleToggleCamera}
          >
            <Icon 
              name={isCameraOn ? "videocam" : "videocam-off"} 
              size={30} 
              color={isCameraOn ? theme.text : theme.buttonText} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton, { backgroundColor: theme.error }]}
            onPress={handleEndCall}
          >
            <Icon name="call-end" size={30} color={theme.buttonText} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Default screen (no call)
  console.log('Rendering default screen, callStatus:', callStatus);
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title={t('call')} />
      <View style={styles.content}>
        <Text style={[styles.noCallText, { color: theme.textSecondary }]}>{t('noActiveCall')}</Text>
        <Text style={[styles.yourIdText, { color: theme.textSecondary }]}>{t('yourId')}: {userId}</Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Calls' })}
        >
          <Text style={[styles.backButtonText, { color: theme.buttonText }]}>{t('backToCalls')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  callContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideoPlaceholder: {
    flex: 1,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  remoteVideoText: {
    color: '#fff',
    fontSize: 18,
  },
  remoteVideoSubtext: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 10,
  },
  localVideo: {
    position: 'absolute',
    top: 80,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 5,
    backgroundColor: '#666',
    zIndex: 10, // Ensure local video is always on top
  },
  localVideoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  localVideoText: {
    color: '#fff',
    fontSize: 12,
  },
  callInfo: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5, // Below local video but above remote video
  },
  callInfoText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  callDurationText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 5,
  },
  callControls: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 5, // Above remote video
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 20,
  },
  controlButtonText: {
    color: '#000',
    fontSize: 12,
    marginTop: 5,
  },
  mutedButton: {
    backgroundColor: '#ff4444',
  },
  disabledButton: {
    backgroundColor: '#666',
  },
  endCallButton: {
    backgroundColor: '#ff4444',
    padding: 10,
    borderRadius: 25,
  },
  incomingCallText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  callingText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  callingSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    marginBottom: 30,
  },
  userIdText: {
    fontSize: 20,
    marginBottom: 30,
  },
  yourIdText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
  },
  singleActionButton: {
    marginTop: 50,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#ff4444',
  },
  acceptButton: {
    backgroundColor: '#00C853',
  },
  noCallText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  backButton: {
    backgroundColor: '#D88A22',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CallScreen;
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
    remoteUserPhoneNumber, // Add remote user phone number
    dialedPhoneNumber, // Add dialed phone number
    endCall,
    acceptCall,
    rejectCall,
    toggleMicrophone,
    toggleCamera,
    getLocalStream,
    getRemoteStream,
    isInCall,
    userId,
    isRecording,
    startRecording,
    stopRecording,
  } = useWebRTC();

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState(null);
  const [isAccepting, setIsAccepting] = useState(false); // Add state to prevent multiple accepts
  const [isShowingAlert, setIsShowingAlert] = useState(false); // Track when alert is shown

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
      console.log('App state changed to:', nextAppState);
      if (nextAppState === 'background') {
        // App is going to background, end call
        // But only if we're not showing an alert
        if (isInCall && !isShowingAlert) {
          console.log('App going to background, ending call');
          endCall();
        } else if (isShowingAlert) {
          console.log('App going to background while showing alert, not ending call');
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      if (subscription && subscription.remove) {
        subscription.remove();
      }
    };
  }, [isInCall, endCall, isShowingAlert]);

  // Auto-navigate back to Calls screen when call ends
  useEffect(() => {
    if (callStatus === 'ended') {
      // Navigate back to calls screen after a short delay
      const timer = setTimeout(() => {
        navigation.navigate('MainTabs', { screen: 'Calls' });
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [callStatus, navigation]);

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

  // Handle toggle recording
  const handleToggleRecording = async () => {
    try {
      console.log('Toggle recording button pressed. Current recording state:', isRecording);
      
      // Reset the alert flag after 3 seconds in case user doesn't dismiss
      const alertTimeout = setTimeout(() => {
        if (isShowingAlert) {
          console.log('Resetting isShowingAlert flag after timeout');
          setIsShowingAlert(false);
        }
      }, 3000);
      
      if (isRecording) {
        console.log('Stopping recording...');
        setIsShowingAlert(true); // Set flag before showing alert
        const success = await stopRecording();
        console.log('Stop recording result:', success);
        if (success) {
          Alert.alert(t('recordingStopped'), t('callRecordingSaved'), [
            { text: 'OK', onPress: () => {
                setIsShowingAlert(false);
                clearTimeout(alertTimeout);
              }
            }
          ]);
        } else {
          Alert.alert(t('error'), t('failedToStopRecording'), [
            { text: 'OK', onPress: () => {
                setIsShowingAlert(false);
                clearTimeout(alertTimeout);
              }
            }
          ]);
        }
      } else {
        console.log('Starting recording...');
        setIsShowingAlert(true); // Set flag before showing alert
        const success = await startRecording();
        console.log('Start recording result:', success);
        if (success) {
          Alert.alert(t('recordingStarted'), t('callIsBeingRecorded'), [
            { text: 'OK', onPress: () => {
                setIsShowingAlert(false);
                clearTimeout(alertTimeout);
              }
            }
          ]);
        } else {
          Alert.alert(t('error'), t('failedToStartRecording'), [
            { text: 'OK', onPress: () => {
                setIsShowingAlert(false);
                clearTimeout(alertTimeout);
              }
            }
          ]);
        }
      }
    } catch (error) {
      console.error('Error toggling recording:', error);
      setIsShowingAlert(false); // Reset flag on error
      // Show error but don't disconnect the call
      Alert.alert(t('error'), t('failedToToggleRecording') + ': ' + error.message);
      // Continue with the call - don't end it
    }
  };

  // Render incoming call screen
  if (callStatus === 'incoming') {
    console.log('Rendering incoming call screen');
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title={t('incomingCall')} />
        
        <View style={styles.content}>
          <Text style={[styles.incomingCallText, { color: theme.text }]}>{t('incomingCall')}</Text>
          <Text style={[styles.userIdText, { color: theme.text }]}>{t('from')}: {remoteUserPhoneNumber || remoteUserId}</Text>
          
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
      <View style={styles.container}>
        {/* Top panel - absolute top full width orange block */}
        <View style={styles.topPanelFull}>
          <Text style={styles.number}>{dialedPhoneNumber || remoteUserId}</Text>
          <View style={styles.line} />
          <Text style={styles.subText}>{t('calling')}...</Text>
        </View>

        {/* Call options */}
        <View style={styles.buttonsGrid}>
          <View style={styles.option}>
            <TouchableOpacity 
              style={styles.iconWrapper}
              onPress={handleToggleMicrophone}
            >
              <Icon name={isMicOn ? "mic" : "mic-off"} size={32} color="#000" />
            </TouchableOpacity>
            <Text style={styles.label}>{t('sound')}</Text>
          </View>

          <View style={styles.option}>
            <TouchableOpacity 
              style={styles.iconWrapper}
              onPress={handleToggleCamera}
            >
              <Icon name={isCameraOn ? "videocam" : "videocam-off"} size={32} color="#000" />
            </TouchableOpacity>
            <Text style={styles.label}>{t('video')}</Text>
          </View>

          <View style={styles.option}>
            <View style={styles.iconWrapper}>
              <Icon name="volume-up" size={32} color="#000" />
            </View>
            <Text style={styles.label}>{t('speaker')}</Text>
          </View>

          <View style={styles.option}>
            <View style={styles.iconWrapper}>
              <Icon name="sync" size={32} color="#000" />
            </View>
            <Text style={styles.label}>{t('transfer')}</Text>
          </View>

          <View style={styles.option}>
            <View style={styles.iconWrapper}>
              <Icon name="dialpad" size={32} color="#000" />
            </View>
            <Text style={styles.label}>{t('keypad')}</Text>
          </View>

          <View style={styles.option}>
            <TouchableOpacity 
              style={[styles.iconWrapper, isRecording && styles.recordingActive]}
              onPress={handleToggleRecording}
            >
              <Icon name={isRecording ? "stop" : "fiber-manual-record"} size={32} color={isRecording ? "#ff0000" : "#000"} />
            </TouchableOpacity>
            <Text style={styles.label}>{t('record')}</Text>
          </View>
        </View>

        {/* End call */}
        <TouchableOpacity 
          style={styles.endCallBtn}
          onPress={handleEndCall}
        >
          <Icon name="call-end" size={32} color="#fff" />
        </TouchableOpacity>
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
            <Text style={[styles.remoteVideoText, { color: theme.text }]}>{t('noVideoFrom')} {dialedPhoneNumber || remoteUserId}</Text>
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
          <Text style={[styles.callInfoText, { color: theme.text }]}>{dialedPhoneNumber || remoteUserId}</Text>
          <Text style={[styles.callDurationText, { color: theme.text }]}>{formatCallDuration(callDuration)}</Text>
        </View>
        
        {/* Recording indicator */}
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <Icon name="fiber-manual-record" size={16} color="#ff0000" />
            <Text style={styles.recordingText}>{t('recording')}</Text>
          </View>
        )}
        
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
            style={[styles.controlButton, isRecording && styles.recordingButton, { backgroundColor: isRecording ? theme.error : theme.cardBackground }]}
            onPress={handleToggleRecording}
          >
            <Icon 
              name={isRecording ? "stop" : "fiber-manual-record"} 
              size={30} 
              color={isRecording ? theme.buttonText : theme.text} 
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
    backgroundColor: '#E5E5E5',
    alignItems: 'center',
    paddingTop: 80 // Adjusted for reduced height of orange panel
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  topPanel: {
    alignItems: 'center',
    marginBottom: 60
  },
  topPanelFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#D68B1F',
    paddingVertical: 10, // Reduced height of orange panel
    alignItems: 'center',
    zIndex: 10,
  },
  number: {
    fontSize: 26,
    fontWeight: '600',
    color: '#fff',
  },
  line: {
    width: 200,
    height: 2,
    backgroundColor: '#fff',
    marginTop: 5,
    marginBottom: 5,
  },
  subText: {
    fontSize: 16,
    color: '#fff',
    marginTop: 5
  },
  buttonsGrid: {
    width: '80%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 30,
    marginTop: 230
  },
  option: {
    width: '30%',
    alignItems: 'center'
  },
  iconWrapper: {
    width: 70,
    height: 70,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center'
  },
  recordingActive: {
    backgroundColor: '#ffebee', // Light red background when recording
  },
  label: {
    marginTop: 8,
    fontSize: 14,
    color: '#000'
  },
  endCallBtn: {
    position: 'absolute',
    bottom: 60,
    width: 75,
    height: 75,
    backgroundColor: 'red',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5
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
  recordingIndicator: {
    position: 'absolute',
    top: 130,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  recordingText: {
    color: '#ff0000',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
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
  recordingButton: {
    backgroundColor: '#ff4444',
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
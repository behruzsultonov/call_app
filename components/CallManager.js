import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import Icon from 'react-native-vector-icons/MaterialIcons';
import WebRTCService from '../services/WebRTCService';

const CallManager = ({ children }) => {
  const [userId, setUserId] = useState('');
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [showCallScreen, setShowCallScreen] = useState(false);
  const [callerId, setCallerId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [callStatus, setCallStatus] = useState('connecting'); // connecting, connected, ended
  const [callDuration, setCallDuration] = useState(0);

  const webRTCServiceRef = useRef(new WebRTCService());
  const callTimerRef = useRef(null);

  useEffect(() => {
    // Initialize WebRTC service
    const initializeWebRTC = async () => {
      try {
        webRTCServiceRef.current.onIncomingCall = handleIncomingCall;
        webRTCServiceRef.current.onCallAnswered = handleCallAnswered;
        webRTCServiceRef.current.onRemoteStream = handleRemoteStream;
        webRTCServiceRef.current.onCallEnded = handleCallEnded;
        webRTCServiceRef.current.onConnectionError = handleConnectionError;

        const id = await webRTCServiceRef.current.initialize();
        setUserId(id);
      } catch (error) {
        console.error('Error initializing WebRTC:', error);
        Alert.alert('Error', 'Failed to initialize calling service');
      }
    };

    initializeWebRTC();

    return () => {
      // Clean up
      if (webRTCServiceRef.current) {
        webRTCServiceRef.current.endCall();
      }
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  // Handle incoming call
  const handleIncomingCall = (callerId, offer) => {
    setCallerId(callerId);
    setShowIncomingCall(true);
    webRTCServiceRef.current.currentOffer = offer;
  };

  // Handle call answered
  const handleCallAnswered = () => {
    setShowCallScreen(true);
    setCallStatus('connected');
    startCallTimer();
  };

  // Handle remote stream
  const handleRemoteStream = (stream) => {
    setRemoteStream(stream);
  };

  // Handle call ended
  const handleCallEnded = () => {
    resetCallState();
  };

  // Handle connection error
  const handleConnectionError = (error) => {
    console.error('Connection error:', error);
    Alert.alert('Connection Error', 'There was an error with the call connection');
    resetCallState();
  };

  // Start call timer
  const startCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    
    let seconds = 0;
    callTimerRef.current = setInterval(() => {
      seconds++;
      setCallDuration(seconds);
    }, 1000);
  };

  // Format call duration
  const formatCallDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Reset call state
  const resetCallState = () => {
    setShowIncomingCall(false);
    setShowCallScreen(false);
    setCallerId('');
    setTargetUserId('');
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('ended');
    setCallDuration(0);
    
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    try {
      setShowIncomingCall(false);
      setShowCallScreen(true);
      setCallStatus('connecting');
      
      // Set local stream
      const stream = webRTCServiceRef.current.getLocalStream();
      setLocalStream(stream);
      
      // Answer the call
      await webRTCServiceRef.current.answerCall(
        callerId,
        webRTCServiceRef.current.currentOffer
      );
    } catch (error) {
      console.error('Error accepting call:', error);
      Alert.alert('Error', 'Failed to accept call');
      resetCallState();
    }
  };

  // Reject incoming call
  const rejectCall = () => {
    // In a real implementation, you would send a reject signal
    setShowIncomingCall(false);
    webRTCServiceRef.current.endCall();
  };

  // Make a call
  const makeCall = async (targetId) => {
    try {
      setTargetUserId(targetId);
      setShowCallScreen(true);
      setCallStatus('connecting');
      
      // Set local stream
      const stream = webRTCServiceRef.current.getLocalStream();
      setLocalStream(stream);
      
      // Make the call
      await webRTCServiceRef.current.makeCall(targetId);
    } catch (error) {
      console.error('Error making call:', error);
      Alert.alert('Error', 'Failed to make call');
      resetCallState();
    }
  };

  // End current call
  const endCall = () => {
    webRTCServiceRef.current.endCall();
    resetCallState();
  };

  // Toggle microphone
  const toggleMicrophone = () => {
    const newState = webRTCServiceRef.current.toggleMicrophone();
    setIsMicOn(newState);
  };

  // Toggle camera
  const toggleCamera = () => {
    const newState = webRTCServiceRef.current.toggleCamera();
    setIsCameraOn(newState);
  };

  // Switch camera
  const switchCamera = () => {
    webRTCServiceRef.current.switchCamera();
  };

  // Render incoming call modal
  const renderIncomingCallModal = () => (
    <Modal
      transparent={true}
      animationType="slide"
      visible={showIncomingCall}
      onRequestClose={() => setShowIncomingCall(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Incoming Call</Text>
          <Text style={styles.modalText}>From: {callerId}</Text>
          
          <View style={styles.modalButtonContainer}>
            <TouchableOpacity
              style={[styles.modalButton, styles.rejectButton]}
              onPress={rejectCall}
            >
              <Icon name="call-end" size={30} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.acceptButton]}
              onPress={acceptCall}
            >
              <Icon name="call" size={30} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Render call screen
  const renderCallScreen = () => (
    <Modal
      transparent={false}
      animationType="slide"
      visible={showCallScreen}
      onRequestClose={endCall}
    >
      <View style={styles.callContainer}>
        {/* Remote video stream */}
        {remoteStream ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
          />
        ) : (
          <View style={styles.remoteVideoPlaceholder}>
            <Text style={styles.remoteVideoText}>
              {callStatus === 'connecting' ? 'Connecting...' : 'No video'}
            </Text>
          </View>
        )}
        
        {/* Local video stream (picture-in-picture) */}
        {localStream && (
          <View style={styles.localVideoContainer}>
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              mirror={true}
            />
          </View>
        )}
        
        {/* Call info */}
        <View style={styles.callInfo}>
          <Text style={styles.callInfoText}>
            {webRTCServiceRef.current.getIsCaller() 
              ? `Calling ${targetUserId}` 
              : `Call from ${callerId}`}
          </Text>
          {callStatus === 'connected' && (
            <Text style={styles.callDurationText}>
              {formatCallDuration(callDuration)}
            </Text>
          )}
        </View>
        
        {/* Call controls */}
        <View style={styles.callControls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleMicrophone}
          >
            <Icon 
              name={isMicOn ? "mic" : "mic-off"} 
              size={30} 
              color={isMicOn ? "#fff" : "#ff4444"} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleCamera}
          >
            <Icon 
              name={isCameraOn ? "videocam" : "videocam-off"} 
              size={30} 
              color={isCameraOn ? "#fff" : "#ff4444"} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.controlButton}
            onPress={switchCamera}
          >
            <Icon name="flip-camera-android" size={30} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton]}
            onPress={endCall}
          >
            <Icon name="call-end" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={{ flex: 1 }}>
      {children({
        userId,
        makeCall,
        endCall,
        isInCall: webRTCServiceRef.current.getIsInCall(),
      })}
      
      {renderIncomingCallModal()}
      {renderCallScreen()}
    </View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 18,
    marginBottom: 30,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
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
  localVideoContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 5,
  },
  localVideo: {
    flex: 1,
    backgroundColor: '#666',
  },
  callInfo: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  callInfoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  callDurationText: {
    color: '#fff',
    fontSize: 16,
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
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallButton: {
    backgroundColor: '#ff4444',
  },
});

export default CallManager;
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import WebRTCService from '../services/WebRTCService';
import InCallManager from 'react-native-incall-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/Client'; // Import the API client

// Create the context
const WebRTCContext = createContext();

// Provider component
export const WebRTCProvider = ({ children }) => {
  const [userId, setUserId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, incoming, connected, ended
  const [remoteUserId, setRemoteUserId] = useState('');
  const [remoteUserPhoneNumber, setRemoteUserPhoneNumber] = useState(''); // Add state for remote user phone number
  const [dialedPhoneNumber, setDialedPhoneNumber] = useState(''); // Add state for dialed phone number
  const [remoteStream, setRemoteStream] = useState(null); // Add state for remote stream
  const [localStream, setLocalStream] = useState(null); // Add state for local stream
  const [isRecording, setIsRecording] = useState(false); // Add state for recording
  const [recordingFilePath, setRecordingFilePath] = useState(null); // Add state for recording file path

  const webRTCServiceRef = useRef(null);

  useEffect(() => {
    // Initialize WebRTC service
    const initializeWebRTC = async () => {
      try {
        // Get the actual user ID from AsyncStorage
        let actualUserId = null;
        try {
          const userDataString = await AsyncStorage.getItem('userData');
          if (userDataString) {
            const userData = JSON.parse(userDataString);
            actualUserId = userData.id ? userData.id.toString() : null;
          }
        } catch (error) {
          console.error('Error getting user ID from AsyncStorage:', error);
        }

        webRTCServiceRef.current = new WebRTCService(actualUserId);
        
        // Get the user ID (either actual or generated)
        const id = webRTCServiceRef.current.getUserId();
        setUserId(id);
        
        webRTCServiceRef.current.onIncomingCall = handleIncomingCall;
        webRTCServiceRef.current.onCallAnswered = handleCallAnswered;
        webRTCServiceRef.current.onRemoteStream = handleRemoteStream;
        webRTCServiceRef.current.onCallEnded = handleCallEnded;
        webRTCServiceRef.current.onConnectionError = handleConnectionError;
        webRTCServiceRef.current.onRecordingStarted = handleRecordingStarted;
        webRTCServiceRef.current.onRecordingStopped = handleRecordingStopped;

        // Then initialize the service
        await webRTCServiceRef.current.initialize();
        setIsConnected(true);
        
        // Set initial local stream
        const initialLocalStream = webRTCServiceRef.current.getLocalStream();
        setLocalStream(initialLocalStream);
        console.log('Initial local stream set:', initialLocalStream);
      } catch (error) {
        console.error('Error initializing WebRTC:', error);
      }
    };

    initializeWebRTC();

    return () => {
      // Clean up
      if (webRTCServiceRef.current) {
        webRTCServiceRef.current.endCall();
      }
    };
  }, []);

  // Listen for user data changes
  useEffect(() => {
    const handleUserDataChange = async () => {
      try {
        const userDataString = await AsyncStorage.getItem('userData');
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          const newUserId = userData.id ? userData.id.toString() : null;
          if (newUserId && newUserId !== userId) {
            setUserId(newUserId);
            // Update the WebRTC service with the actual user ID
            if (webRTCServiceRef.current) {
              webRTCServiceRef.current.updateUserId(newUserId);
            }
          }
        }
      } catch (error) {
        console.error('Error handling user data change:', error);
      }
    };

    // Set up a listener for changes to userData in AsyncStorage
    const interval = setInterval(handleUserDataChange, 5000); // Check every 5 seconds

    return () => {
      clearInterval(interval);
    };
  }, [userId]);

  // Handle incoming call
  const handleIncomingCall = async (callerId, offer) => {
    console.log('Handling incoming call from:', callerId);
    setCallStatus('incoming');
    setRemoteUserId(callerId);
    webRTCServiceRef.current.currentOffer = offer;
    
    // Fetch caller's phone number for display
    try {
      const response = await api.getUser(callerId);
      if (response.data.success && response.data.data) {
        const callerData = response.data.data;
        setRemoteUserPhoneNumber(callerData.phone_number || callerId);
      } else {
        // Fallback to callerId if we can't get phone number
        setRemoteUserPhoneNumber(callerId);
      }
    } catch (error) {
      console.error('Error fetching caller phone number:', error);
      // Fallback to callerId if we can't get phone number
      setRemoteUserPhoneNumber(callerId);
    }
    
    // Start ringing for incoming call
    InCallManager.startRingtone('_DEFAULT_', 'default');
  };

  // Handle call answered
  const handleCallAnswered = () => {
    console.log('Call answered, updating UI state');
    setCallStatus('connected');
    setIsInCall(true);
    // Update local stream when call is answered
    if (webRTCServiceRef.current) {
      const stream = webRTCServiceRef.current.getLocalStream();
      console.log('Local stream after call answered:', stream);
      setLocalStream(stream);
    }
  };

  // Handle remote stream
  const handleRemoteStream = (stream) => {
    // This would be used to display the remote video stream
    console.log('Remote stream received in context:', stream);
    console.log('Remote stream tracks:', stream.getTracks());
    setRemoteStream(stream); // Update the remote stream state
  };

  // Handle call ended
  const handleCallEnded = () => {
    console.log('Call ended, cleaning up state');
    setCallStatus('ended');
    setIsInCall(false);
    setRemoteUserId('');
    setRemoteUserPhoneNumber(''); // Clear remote user phone number
    setDialedPhoneNumber(''); // Clear dialed phone number
    setRemoteStream(null); // Clear remote stream
    setLocalStream(null); // Clear local stream
    setIsRecording(false); // Stop recording when call ends
    setRecordingFilePath(null); // Clear recording file path
    
    // Stop ringing when call ends
    InCallManager.stopRingtone();
    
    // Reset to idle after a short delay
    setTimeout(() => {
      setCallStatus('idle');
    }, 1000);
  };

  // Handle connection error
  const handleConnectionError = (error) => {
    console.error('Connection error:', error);
    setCallStatus('ended');
    setIsInCall(false);
    setRemoteUserId('');
    setRemoteStream(null); // Clear remote stream
    setLocalStream(null); // Clear local stream
    setIsRecording(false); // Stop recording on error
    setRecordingFilePath(null); // Clear recording file path
    
    // Stop ringing on connection error
    InCallManager.stopRingtone();
  };

  // Handle recording started
  const handleRecordingStarted = (filePath) => {
    console.log('Recording started, file path:', filePath);
    setIsRecording(true);
    setRecordingFilePath(filePath);
  };

  // Handle recording stopped
  const handleRecordingStopped = (filePath, duration) => {
    console.log('Recording stopped, file path:', filePath, 'duration:', duration);
    setIsRecording(false);
    // Keep the file path for reference
  };

  // Make a call
  const makeCall = async (targetUserId, phoneNumber = null) => {
    // Validate that we have a target user ID
    if (!targetUserId) {
      throw new Error('Target user ID is required.');
    }
    
    // Validate that the target user ID is a valid string representation of a number
    if (isNaN(targetUserId)) {
      throw new Error('Invalid target user ID format.');
    }
    
    try {
      console.log('Making call to user ID:', targetUserId);
      setCallStatus('calling');
      setRemoteUserId(targetUserId.toString()); // Ensure it's a string
      setDialedPhoneNumber(phoneNumber || targetUserId.toString()); // Store the dialed phone number or fallback to user ID
      await webRTCServiceRef.current.makeCall(targetUserId.toString()); // Ensure it's a string
      // Update local stream after making call
      const stream = webRTCServiceRef.current.getLocalStream();
      console.log('Local stream after making call:', stream);
      setLocalStream(stream);
    } catch (error) {
      console.error('Error making call:', error);
      setCallStatus('ended');
      throw error;
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    console.log('Accepting call from:', remoteUserId);
    try {
      await webRTCServiceRef.current.answerCall(
        remoteUserId,
        webRTCServiceRef.current.currentOffer
      );
      // Update UI state immediately after accepting
      setCallStatus('connected');
      setIsInCall(true);
      // Update streams
      const local = webRTCServiceRef.current.getLocalStream();
      const remote = webRTCServiceRef.current.getRemoteStream();
      console.log('Local stream after accepting call:', local);
      console.log('Remote stream after accepting call:', remote);
      setLocalStream(local);
      setRemoteStream(remote);
    } catch (error) {
      console.error('Error accepting call:', error);
      handleCallEnded();
      throw error;
    }
  };

  // Reject incoming call
  const rejectCall = () => {
    console.log('Rejecting call from:', remoteUserId);
    webRTCServiceRef.current.rejectCall();
    handleCallEnded();
  };

  // End current call
  const endCall = () => {
    console.log('Ending current call');
    webRTCServiceRef.current.endCall();
    handleCallEnded();
  };

  // Toggle microphone
  const toggleMicrophone = () => {
    console.log('Toggling microphone');
    return webRTCServiceRef.current.toggleMicrophone();
  };

  // Toggle camera
  const toggleCamera = () => {
    console.log('Toggling camera');
    return webRTCServiceRef.current.toggleCamera();
  };

  // Start recording
  const startRecording = async () => {
    console.log('Starting recording');
    try {
      const success = await webRTCServiceRef.current.startRecording();
      return success; // Return the success status
    } catch (error) {
      console.error('Error starting recording:', error);
      return false; // Return false on error
    }
  };

  // Stop recording
  const stopRecording = async () => {
    console.log('Stopping recording');
    try {
      const success = await webRTCServiceRef.current.stopRecording();
      return success; // Return the success status
    } catch (error) {
      console.error('Error stopping recording:', error);
      return false; // Return false on error
    }
  };

  // Get recording status
  const getRecordingStatus = () => {
    return webRTCServiceRef.current.getRecordingStatus();
  };

  // Get user ID
  const getUserId = () => {
    return userId;
  };

  // Get local stream
  const getLocalStream = () => {
    // Return the state value if available, otherwise get from service
    if (localStream) {
      return localStream;
    }
    return webRTCServiceRef.current ? webRTCServiceRef.current.getLocalStream() : null;
  };

  // Get remote stream
  const getRemoteStream = () => {
    // Return the state value if available, otherwise get from service
    if (remoteStream) {
      return remoteStream;
    }
    return webRTCServiceRef.current ? webRTCServiceRef.current.getRemoteStream() : null;
  };

  // Context value
  const contextValue = {
    userId,
    isConnected,
    isInCall,
    callStatus,
    remoteUserId,
    remoteUserPhoneNumber,
    dialedPhoneNumber,
    isRecording,
    recordingFilePath,
    makeCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMicrophone,
    toggleCamera,
    startRecording,
    stopRecording,
    getRecordingStatus,
    getUserId,
    getLocalStream,
    getRemoteStream,
  };

  return (
    <WebRTCContext.Provider value={contextValue}>
      {children}
    </WebRTCContext.Provider>
  );
};

// Hook to use the WebRTC context
export const useWebRTC = () => {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error('useWebRTC must be used within a WebRTCProvider');
  }
  return context;
};

export default WebRTCContext;
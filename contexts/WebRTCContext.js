import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import WebRTCService from '../services/WebRTCService';

// Create the context
const WebRTCContext = createContext();

// Provider component
export const WebRTCProvider = ({ children }) => {
  const [userId, setUserId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, incoming, connected, ended
  const [remoteUserId, setRemoteUserId] = useState('');
  const [remoteStream, setRemoteStream] = useState(null); // Add state for remote stream
  const [localStream, setLocalStream] = useState(null); // Add state for local stream
  
  const webRTCServiceRef = useRef(null);

  useEffect(() => {
    // Initialize WebRTC service
    const initializeWebRTC = async () => {
      try {
        webRTCServiceRef.current = new WebRTCService();
        
        // Get the user ID immediately (it's generated in the constructor)
        const id = webRTCServiceRef.current.getUserId();
        setUserId(id);
        
        webRTCServiceRef.current.onIncomingCall = handleIncomingCall;
        webRTCServiceRef.current.onCallAnswered = handleCallAnswered;
        webRTCServiceRef.current.onRemoteStream = handleRemoteStream;
        webRTCServiceRef.current.onCallEnded = handleCallEnded;
        webRTCServiceRef.current.onConnectionError = handleConnectionError;

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

  // Handle incoming call
  const handleIncomingCall = (callerId, offer) => {
    console.log('Handling incoming call from:', callerId);
    setCallStatus('incoming');
    setRemoteUserId(callerId);
    webRTCServiceRef.current.currentOffer = offer;
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
    setRemoteStream(null); // Clear remote stream
    setLocalStream(null); // Clear local stream
    
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
  };

  // Make a call
  const makeCall = async (targetUserId) => {
    if (!targetUserId || targetUserId.length !== 4) {
      throw new Error('Invalid target user ID. Must be 4 digits.');
    }
    
    try {
      console.log('Making call to:', targetUserId);
      setCallStatus('calling');
      setRemoteUserId(targetUserId);
      await webRTCServiceRef.current.makeCall(targetUserId);
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
    // In a real implementation, you would send a reject signal
    webRTCServiceRef.current.endCall();
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
    makeCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMicrophone,
    toggleCamera,
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
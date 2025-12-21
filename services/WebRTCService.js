import {
  mediaDevices,
  RTCPeerConnection,
  RTCView,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  registerGlobals
} from 'react-native-webrtc';
import io from 'socket.io-client';
import InCallManager from 'react-native-incall-manager';
import RNFS from 'react-native-fs';
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Sound from 'react-native-nitro-sound';

// Register WebRTC globals for better compatibility
registerGlobals();

class WebRTCService {
  constructor(userId = null) {
    this.socket = null;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.userId = userId ? userId.toString() : this.generateUserId(); // Ensure it's a string
    this.isInCall = false;
    this.isCaller = false;
    this.currentCallTarget = null;
    this.isAnsweringCall = false; // Add flag to prevent multiple answer attempts
    this.pendingICECandidates = []; // Queue for ICE candidates received before remote description
    
    // Recording related properties
    this.isRecording = false;
    this.recordingStartTime = null;
    this.recordingFilePath = null;
    
    // Callbacks
    this.onIncomingCall = null;
    this.onCallAnswered = null;
    this.onRemoteStream = null;
    this.onCallEnded = null;
    this.onConnectionError = null;
    this.onRecordingStarted = null;
    this.onRecordingStopped = null;
  }

  // Generate a 4-digit user ID (fallback)
  generateUserId() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  // Get the user ID (available immediately after construction)
  getUserId() {
    return this.userId;
  }

  // Initialize the WebRTC service
  async initialize() {
    try {
      // Connect to signaling server
      // this.socket = io('https://webrtc-server-n44t.onrender.com', {
      this.socket = io('http://34.179.130.224:3500', {
        transports: ['websocket'],
        query: {
          callerId: this.userId.toString(), // Ensure it's a string
        },
      });

      // Set up socket event listeners
      this.setupSocketListeners();

      // Initialize media devices
      await this.initializeMediaDevices();

      // Initialize peer connection
      this.initializePeerConnection();

      console.log('WebRTC Service initialized with user ID:', this.userId);
      return this.userId;
    } catch (error) {
      console.error('Error initializing WebRTC service:', error);
      if (this.onConnectionError) {
        this.onConnectionError(error);
      }
      throw error; // Re-throw to be caught by caller
    }
  }

  // Update the user ID if we get the actual one later
  updateUserId(newUserId) {
    if (newUserId && newUserId !== this.userId) {
      console.log('Updating WebRTC user ID from', this.userId, 'to', newUserId);
      this.userId = newUserId.toString(); // Ensure it's a string
      
      // If we're already connected, we might need to reconnect with the new ID
      if (this.socket && this.socket.connected) {
        console.log('Reconnecting with new user ID');
        this.socket.disconnect();
        this.socket.io.opts.query.callerId = this.userId;
        this.socket.connect();
      }
    }
  }

  // Set up socket event listeners
  setupSocketListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to signaling server with ID:', this.socket.id);
    });

    this.socket.on('newCall', (data) => {
      console.log('Incoming call from:', data.callerId);
      console.log('Offer data:', data.rtcMessage);
      // Set the caller as the current call target
      this.currentCallTarget = data.callerId;
      if (this.onIncomingCall) {
        this.onIncomingCall(data.callerId, data.rtcMessage);
      }
    });

    this.socket.on('callAnswered', (data) => {
      console.log('Call answered by:', data.callee);
      console.log('Answer data:', data.rtcMessage);
      if (this.peerConnection) {
        this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(data.rtcMessage),
        ).then(() => {
          console.log('Remote description set successfully');
          // Process any pending ICE candidates
          this.processPendingICECandidates();
          if (this.onCallAnswered) {
            this.onCallAnswered();
          }
        }).catch((error) => {
          console.error('Error setting remote description:', error);
          if (this.onConnectionError) {
            this.onConnectionError(error);
          }
        });
      }
    });

    this.socket.on('ICEcandidate', (data) => {
      console.log('Received ICE candidate:', data);
      if (this.peerConnection) {
        // Check if this is from the current call target
        if (data.sender === this.currentCallTarget || !this.currentCallTarget) {
          // Check if remote description is already set
          if (this.peerConnection.remoteDescription) {
            this.peerConnection.addIceCandidate(
              new RTCIceCandidate({
                candidate: data.rtcMessage.candidate,
                sdpMid: data.rtcMessage.id,
                sdpMLineIndex: data.rtcMessage.label,
              }),
            ).then(() => {
              console.log('ICE candidate added successfully');
            }).catch((error) => {
              console.error('Error adding ICE candidate:', error);
            });
          } else {
            // Queue the ICE candidate to be processed later
            console.log('Queuing ICE candidate for later processing');
            this.pendingICECandidates.push(data.rtcMessage);
          }
        } else {
          console.log('Ignoring ICE candidate from non-call target:', data.sender);
        }
      }
    });

    this.socket.on('userLeft', (data) => {
      console.log('User left call:', data.userId);
      this.endCall();
    });
    
    this.socket.on('callRejected', (data) => {
      console.log('Call rejected by user:', data.userId);
      this.endCall();
    });

  }

  // Process pending ICE candidates
  processPendingICECandidates() {
    if (this.peerConnection && this.peerConnection.remoteDescription && this.pendingICECandidates.length > 0) {
      console.log('Processing', this.pendingICECandidates.length, 'pending ICE candidates');
      this.pendingICECandidates.forEach((candidate) => {
        this.peerConnection.addIceCandidate(
          new RTCIceCandidate({
            candidate: candidate.candidate,
            sdpMid: candidate.id,
            sdpMLineIndex: candidate.label,
          }),
        ).then(() => {
          console.log('Pending ICE candidate added successfully');
        }).catch((error) => {
          console.error('Error adding pending ICE candidate:', error);
        });
      });
      // Clear the queue
      this.pendingICECandidates = [];
    }
  }

  // Initialize media devices with better configuration
  async initializeMediaDevices() {
    try {
      const devices = await mediaDevices.enumerateDevices();
      console.log('Available media devices:', devices);

      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 360, ideal: 720, max: 1080 },
          frameRate: { min: 15, ideal: 30, max: 60 },
          facingMode: 'user', // 'user' for front camera, 'environment' for back
        },
      });

      console.log('Local stream acquired with tracks:', this.localStream.getTracks());
      return this.localStream;
    } catch (error) {
      console.error('Error initializing media devices:', error);
      throw error;
    }
  }

  // Initialize peer connection with proper configuration
  initializePeerConnection() {
    // Clean up existing peer connection if any
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: 'turn:195.133.144.252:3478',
          username: 'behruz',
          credential: '12345',
        },
      ],
      iceCandidatePoolSize: 10,
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    // Add local stream to peer connection
    if (this.localStream) {
      // Try both APIs for better compatibility
      if (this.peerConnection.addStream) {
        // Older API
        this.peerConnection.addStream(this.localStream);
        console.log('Added local stream using addStream');
      } else {
        // Modern API
        this.localStream.getTracks().forEach(track => {
          this.peerConnection.addTrack(track, this.localStream);
        });
        console.log('Added local stream using addTrack');
      }
    }

    // Set up peer connection event listeners for both APIs
    // Older API
    this.peerConnection.onaddstream = (event) => {
      console.log('Remote stream received (onaddstream):', event);
      console.log('Remote stream tracks:', event.stream.getTracks());
      
      // Store the remote stream
      this.remoteStream = event.stream;
      
      // Notify about remote stream update
      if (this.onRemoteStream && this.remoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };

    // Modern API (fallback)
    this.peerConnection.ontrack = (event) => {
      console.log('Remote track received (ontrack):', event);
      console.log('Remote track streams:', event.streams);
      
      // Create remote stream if it doesn't exist
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
        console.log('Created new remote stream');
      }
      
      // Add track to remote stream
      if (this.remoteStream && event.track) {
        this.remoteStream.addTrack(event.track);
        console.log('Added track to remote stream. Remote stream tracks:', this.remoteStream.getTracks());
      }
      
      // Notify about remote stream update
      if (this.onRemoteStream && this.remoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };

    // ICE candidate event
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('ICE candidate generated:', event.candidate);
        // Only send if we have a target
        if (this.currentCallTarget && this.socket) {
          // For caller, send to callee
          // For callee, send to caller
          this.socket.emit('ICEcandidate', {
            calleeId: this.currentCallTarget,
            rtcMessage: {
              label: event.candidate.sdpMLineIndex,
              id: event.candidate.sdpMid,
              candidate: event.candidate.candidate,
            },
          });
        }
      } else {
        console.log('ICE gathering completed');
      }
    };

    this.peerConnection.onconnectionstatechange = (event) => {
      // Check if peerConnection is still valid
      if (this.peerConnection) {
        console.log('Connection state changed:', this.peerConnection.connectionState);
        if (this.peerConnection.connectionState === 'failed') {
          console.log('Connection failed');
          if (this.onConnectionError) {
            this.onConnectionError(new Error('Connection failed'));
          }
        } else if (this.peerConnection.connectionState === 'connected') {
          console.log('Connection established successfully');
        }
      }
    };

    this.peerConnection.oniceconnectionstatechange = (event) => {
      // Check if peerConnection is still valid
      if (this.peerConnection) {
        console.log('ICE connection state changed:', this.peerConnection.iceConnectionState);
        if (this.peerConnection.iceConnectionState === 'failed') {
          console.log('ICE connection failed');
          if (this.onConnectionError) {
            this.onConnectionError(new Error('ICE connection failed'));
          }
        } else if (this.peerConnection.iceConnectionState === 'connected') {
          console.log('ICE connection established');
        } else if (this.peerConnection.iceConnectionState === 'disconnected') {
          console.log('ICE connection disconnected');
        }
      }
    };

    // Add data channel event for debugging
    this.peerConnection.ondatachannel = (event) => {
      console.log('Data channel received:', event);
    };

    // Add negotiation needed event for debugging
    this.peerConnection.onnegotiationneeded = (event) => {
      console.log('Negotiation needed:', event);
    };
  }

  // Make a call to another user
  async makeCall(targetUserId) {
    try {
      this.isCaller = true;
      this.currentCallTarget = targetUserId.toString(); // Ensure it's a string
      
      // Ensure we have a peer connection
      if (!this.peerConnection) {
        this.initializePeerConnection();
      }

      // Ensure we have a media stream
      if (!this.localStream) {
        await this.initializeMediaDevices();
        if (this.peerConnection && this.localStream) {
          // Add stream to peer connection
          if (this.peerConnection.addStream) {
            // Older API
            this.peerConnection.addStream(this.localStream);
          } else {
            // Modern API
            this.localStream.getTracks().forEach(track => {
              this.peerConnection.addTrack(track, this.localStream);
            });
          }
        }
      }

      console.log('Creating offer to:', this.currentCallTarget);
      const sessionDescription = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      console.log('Offer created:', sessionDescription);
      await this.peerConnection.setLocalDescription(sessionDescription);
      
      console.log('Sending call to:', this.currentCallTarget);
      this.socket.emit('call', {
        calleeId: this.currentCallTarget,
        rtcMessage: sessionDescription,
      });

      this.isInCall = true;
      
      // Start ringing sound for outgoing call
      InCallManager.start({media: 'audio'});
      InCallManager.setKeepScreenOn(true);
      InCallManager.setForceSpeakerphoneOn(false);
    } catch (error) {
      console.error('Error making call:', error);
      if (this.onConnectionError) {
        this.onConnectionError(error);
      }
      throw error;
    }
  }

  // Answer an incoming call
  async answerCall(callerId, offer) {
    // Prevent multiple answer attempts
    if (this.isAnsweringCall) {
      console.log('Already answering call, skipping duplicate request');
      return;
    }
    
    try {
      this.isAnsweringCall = true;
      this.isCaller = false;
      this.currentCallTarget = callerId.toString(); // Ensure it's a string
      
      // Stop ringing when answering the call
      InCallManager.stopRingtone();
      
      // Ensure we have a peer connection
      if (!this.peerConnection) {
        this.initializePeerConnection();
      }

      // Ensure we have a media stream
      if (!this.localStream) {
        await this.initializeMediaDevices();
        if (this.peerConnection && this.localStream) {
          // Add stream to peer connection
          if (this.peerConnection.addStream) {
            // Older API
            this.peerConnection.addStream(this.localStream);
          } else {
            // Modern API
            this.localStream.getTracks().forEach(track => {
              this.peerConnection.addTrack(track, this.localStream);
            });
          }
        }
      }

      console.log('Setting remote description for caller:', this.currentCallTarget);
      console.log('Offer:', offer);
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer),
      );

      // Process any pending ICE candidates
      this.processPendingICECandidates();

      console.log('Creating answer');
      const sessionDescription = await this.peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      console.log('Answer created:', sessionDescription);
      await this.peerConnection.setLocalDescription(sessionDescription);

      console.log('Sending answer to:', this.currentCallTarget);
      this.socket.emit('answerCall', {
        callerId: this.currentCallTarget,
        rtcMessage: sessionDescription,
      });

      this.isInCall = true;
      InCallManager.start({media: 'audio'}); // Simplified InCallManager usage
      InCallManager.setKeepScreenOn(true);
      InCallManager.setForceSpeakerphoneOn(false);
    } catch (error) {
      console.error('Error answering call:', error);
      this.isAnsweringCall = false; // Reset flag on error
      if (this.onConnectionError) {
        this.onConnectionError(error);
      }
      throw error;
    }
    
    // Reset flag after successful answer
    this.isAnsweringCall = false;
  }

  // End the current call
  endCall() {
    console.log('Ending call');
    
    // Stop recording if active
    if (this.isRecording) {
      this.stopRecording();
    }
    
    // Notify the other user
    if (this.currentCallTarget && this.socket) {
      this.socket.emit('leaveCall', {
        userId: this.currentCallTarget,
      });
    }

    // Clean up local resources
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Check if peerConnection is still valid before closing
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.isInCall = false;
    this.isCaller = false;
    this.currentCallTarget = null;
    this.isAnsweringCall = false; // Reset answer flag
    this.remoteStream = null; // Clear remote stream
    this.pendingICECandidates = []; // Clear pending ICE candidates
    
    // Stop all InCallManager sounds
    InCallManager.stop();

    if (this.onCallEnded) {
      this.onCallEnded();
    }
  }

  // Reject an incoming call
  rejectCall() {
    console.log('Rejecting call from:', this.currentCallTarget);
    
    // Notify the caller that the call was rejected
    if (this.currentCallTarget && this.socket) {
      this.socket.emit('rejectCall', {
        userId: this.currentCallTarget,
      });
    }
    
    // Clean up local resources
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    // Check if peerConnection is still valid before closing
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.isInCall = false;
    this.isCaller = false;
    this.currentCallTarget = null;
    this.isAnsweringCall = false; // Reset answer flag
    this.remoteStream = null; // Clear remote stream
    this.pendingICECandidates = []; // Clear pending ICE candidates
    
    // Stop all InCallManager sounds
    InCallManager.stop();
    InCallManager.stopRingtone();
    
    if (this.onCallEnded) {
      this.onCallEnded();
    }
  }

  // Toggle microphone
  toggleMicrophone() {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        track.enabled = !track.enabled;
        console.log('Microphone toggled, enabled:', track.enabled);
        return track.enabled;
      }
    }
    return false;
  }

  // Toggle camera
  toggleCamera() {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const track = videoTracks[0];
        track.enabled = !track.enabled;
        console.log('Camera toggled, enabled:', track.enabled);
        return track.enabled;
      }
    }
    return false;
  }

  // Switch camera
  switchCamera() {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const track = videoTracks[0];
        if (track._switchCamera) {
          track._switchCamera();
          return true;
        }
      }
    }
    return false;
  }

  // Request audio recording permission
  async requestAudioPermission() {
    if (Platform.OS === 'android') {
      try {
        // For Android, we primarily need RECORD_AUDIO permission
        // WRITE_EXTERNAL_STORAGE is not needed when saving to app's private directory
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Audio Recording Permission',
            message: 'This app needs permission to record audio for call recording',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // iOS permissions are handled differently
  }

  // Start recording the call (real audio recording from microphone)
  async startRecording() {
    try {
      if (!this.isInCall) {
        console.log('Not in a call, cannot start recording');
        return false; // Return false instead of throwing error
      }

      if (this.isRecording) {
        console.log('Already recording');
        return true; // Already recording, return success
      }

      // Request audio permission
      const hasPermission = await this.requestAudioPermission();
      if (!hasPermission) {
        console.log('Audio recording permission denied');
        return false; // Return false instead of throwing error
      }

      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `call_recording_${timestamp}.aac`;
      
      // Save to a more accessible directory for both platforms
      let recordingPath;
      if (Platform.OS === 'android') {
        // For Android, save to Downloads directory for better accessibility
        const downloadsDir = RNFS.DownloadDirectoryPath;
        recordingPath = `${downloadsDir}/${fileName}`;
        
        // Request storage permission for Android
        if (Platform.Version >= 23) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            {
              title: 'Storage Permission',
              message: 'App needs access to storage to save recordings',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
          
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            // Fallback to Documents directory if permission denied
            recordingPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
          }
        }
      } else {
        // For iOS, save to Documents directory
        recordingPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      }
      
      this.recordingFilePath = recordingPath;
      console.log('Recording file path:', this.recordingFilePath);

      // Start recording with react-native-nitro-sound
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      
      // Set up recording progress listener
      Sound.addRecordBackListener((e) => {
        console.log('Recording progress:', e.currentPosition);
      });

      // Start recording with the specified path
      const result = await Sound.startRecorder(recordingPath);
      console.log('Recording started:', result);
      
      console.log('Started recording call to:', this.recordingFilePath);
      
      if (this.onRecordingStarted) {
        this.onRecordingStarted(this.recordingFilePath);
      }
      
      return true; // Return success
    } catch (error) {
      console.error('Error starting recording:', error);
      this.isRecording = false;
      return false; // Return false instead of throwing error
    }
  }

  // Stop recording the call
  async stopRecording() {
    try {
      if (!this.isRecording) {
        console.log('Not currently recording');
        return true; // Not recording, but that's fine, return success
      }

      // Stop recording
      this.isRecording = false;
      const recordingEndTime = Date.now();
      const recordingDuration = recordingEndTime - this.recordingStartTime;
      
      console.log('Stopping recording...');
      
      // Stop recording with react-native-nitro-sound
      const result = await Sound.stopRecorder();
      console.log('Recording stopped:', result);
      
      // Remove recording listener
      Sound.removeRecordBackListener();
      
      console.log('Stopped recording. Duration:', recordingDuration, 'ms');
      console.log('Recording saved to:', this.recordingFilePath);
      
      if (this.onRecordingStopped) {
        this.onRecordingStopped(this.recordingFilePath, recordingDuration);
      }
      
      // Reset recording state
      this.recordingStartTime = null;
      this.recordingFilePath = null;
      
      return true; // Return success
    } catch (error) {
      console.error('Error stopping recording:', error);
      // Clean up listeners even if there's an error
      try {
        Sound.removeRecordBackListener();
      } catch (e) {
        console.log('Error cleaning up recording listeners:', e);
      }
      // Reset recording state even if there's an error
      this.isRecording = false;
      this.recordingStartTime = null;
      this.recordingFilePath = null;
      return false; // Return false instead of throwing error
    }
  }

  // Get recording status
  getRecordingStatus() {
    return {
      isRecording: this.isRecording,
      filePath: this.recordingFilePath,
      startTime: this.recordingStartTime,
    };
  }

  // Get local stream
  getLocalStream() {
    return this.localStream;
  }

  // Get remote stream
  getRemoteStream() {
    return this.remoteStream;
  }

  // Get user ID
  getUserId() {
    return this.userId;
  }

  // Check if in call
  getIsInCall() {
    return this.isInCall;
  }

  // Check if caller
  getIsCaller() {
    return this.isCaller;
  }
}

export default WebRTCService;
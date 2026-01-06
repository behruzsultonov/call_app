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
import RecordingManager from './RecordingManager';

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
    this.isVideoCall = false; // Track if this is a video or audio call, default to audio
    this.isAnsweringCall = false; // Add flag to prevent multiple answer attempts
    this.pendingICECandidates = []; // Queue for ICE candidates received before remote description

    // Recording manager
    this.recordingManager = new RecordingManager(this);

    // Callbacks
    this.onIncomingCall = null;
    this.onCallAnswered = null;
    this.onRemoteStream = null;
    this.onCallEnded = null;
    this.onConnectionError = null;
    this.onRecordingStarted = null;
    this.onRecordingStopped = null;
    this.onServerRecordingStarted = null; // Server recording callbacks
    this.onServerRecordingStopped = null;
    this.onServerRecordingError = null;
    this.producerId = null; // Track producer ID
    this.isServerRecording = false; // Track server recording state
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

      // Set up server recording event listeners
      this.setupServerRecordingListeners();

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
      console.log('Call type:', data.callType);
      // Set the caller as the current call target
      this.currentCallTarget = data.callerId;
      if (this.onIncomingCall) {
        this.onIncomingCall(data.callerId, data.callType, data.rtcMessage);
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
          
          // After call is answered and remote description is set, start sending to server
          // This ensures both parties are publishing audio to mediasoup for recording
          setTimeout(() => {
            this.startSendToServer();
          }, 1000); // Small delay to ensure connection is established
          
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
  async initializeMediaDevices(isVideoCall = true) {
    try {
      const devices = await mediaDevices.enumerateDevices();
      console.log('Available media devices:', devices);

      const constraints = {
        audio: true,
      };

      if (isVideoCall) {
        constraints.video = {
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 360, ideal: 720, max: 1080 },
          frameRate: { min: 15, ideal: 30, max: 60 },
          facingMode: 'user', // 'user' for front camera, 'environment' for back
        };
      }

      this.localStream = await mediaDevices.getUserMedia(constraints);

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
        
        // NOTE: We no longer create producers here using createProducer() as it's the incorrect method
        // Instead, we rely on startSendToServer() to properly publish audio to mediasoup
      } else {
        // Modern API
        this.localStream.getTracks().forEach(track => {
          this.peerConnection.addTrack(track, this.localStream);
          // NOTE: We no longer create producers here using createProducer() as it's the incorrect method
          // Instead, we rely on startSendToServer() to properly publish audio to mediasoup
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
  async makeCall(targetUserId, isVideoCall = false) {
    try {
      this.isCaller = true;
      this.isVideoCall = isVideoCall; // Set whether this is a video or audio-only call
      this.currentCallTarget = targetUserId.toString(); // Ensure it's a string

      // Ensure we have a peer connection
      if (!this.peerConnection) {
        this.initializePeerConnection();
      }

      // Ensure we have a media stream
      if (!this.localStream) {
        await this.initializeMediaDevices(isVideoCall);
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
        offerToReceiveVideo: isVideoCall,
      });
      console.log('Offer created:', sessionDescription);
      await this.peerConnection.setLocalDescription(sessionDescription);

      console.log('Sending call to:', this.currentCallTarget);
      this.socket.emit('call', {
        calleeId: this.currentCallTarget,
        callType: isVideoCall ? 'video' : 'audio',
        rtcMessage: sessionDescription,
      });

      this.isInCall = true;

      // Start ringing sound for outgoing call
      InCallManager.start({ media: 'audio' });
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
  async answerCall(callerId, offer, isVideoCall = false) {
    // Prevent multiple answer attempts
    if (this.isAnsweringCall) {
      console.log('Already answering call, skipping duplicate request');
      return;
    }

    try {
      this.isAnsweringCall = true;
      this.isCaller = false;
      this.isVideoCall = isVideoCall; // Set whether this is a video or audio-only call
      this.currentCallTarget = callerId.toString(); // Ensure it's a string

      // Stop ringing when answering the call
      InCallManager.stopRingtone();

      // Ensure we have a peer connection
      if (!this.peerConnection) {
        this.initializePeerConnection();
      }

      // Ensure we have a media stream
      if (!this.localStream) {
        await this.initializeMediaDevices(isVideoCall);
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
        offerToReceiveVideo: isVideoCall,
      });
      console.log('Answer created:', sessionDescription);
      await this.peerConnection.setLocalDescription(sessionDescription);

      console.log('Sending answer to:', this.currentCallTarget);
      this.socket.emit('answerCall', {
        callerId: this.currentCallTarget,
        rtcMessage: sessionDescription,
      });

      this.isInCall = true;
      InCallManager.start({ media: 'audio' }); // Simplified InCallManager usage
      InCallManager.setKeepScreenOn(true);
      InCallManager.setForceSpeakerphoneOn(false);
      
      // After sending answer and setting local description, start sending to server
      // This ensures both parties are publishing audio to mediasoup for recording
      setTimeout(() => {
        this.startSendToServer();
      }, 1000); // Small delay to ensure connection is established
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

    // Stop server recording if active
    if (this.isServerRecording) {
      const callId = this.currentCallTarget || this.getUserId();
      this.stopServerRecording(callId);
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

  // Create a deterministic room ID for the call so both peers use the same one
  getCanonicalRoomId(otherId) {
    // If we don't have the other participant yet, fall back to user ID
    const a = (this.userId || '').toString();
    const b = (otherId || this.currentCallTarget || this.userId || '').toString();
    if (!a || !b) return a || b;

    // Sort so both sides produce the same room id (e.g., '1000-2000')
    const parts = [a, b].sort();
    return `${parts[0]}-${parts[1]}`;
  }

  // Create producer for track - DEPRECATED
  // This method is the incorrect way to publish audio to mediasoup
  // Use startSendToServer() instead which uses mediasoup-client Device + sendTransport.produce({track})
  /*
  async createProducer(track, stream) {
    try {
      // Only create producers for audio tracks
      if (track.kind !== 'audio') {
        return;
      }

      // Guard: only produce when in a call or when we have a call target
      if (!this.isInCall && !this.currentCallTarget) {
        console.log('Skipping createProducer: not in call and no current call target');
        return;
      }

      console.log('Creating producer for track:', track.id);

      // Make sure we have a sender for this track
      const sender = this.peerConnection.getSenders().find(s => s.track === track);
      if (!sender) {
        console.warn('No sender found for track');
        return;
      }

      // Get the parameters needed for the producer
      const parameters = sender.getParameters();
      if (!parameters || !parameters.encodings || parameters.encodings.length === 0) {
        console.warn('No encodings found for track');
        return;
      }

      // Determine canonical room id so both peers join the same room
      const roomId = this.getCanonicalRoomId(this.currentCallTarget);
      console.log('Using canonical roomId for produce:', roomId);

      // Request server to create a transport for this room
      const transportInfo = await new Promise((resolve, reject) => {
        const onCreated = (data) => {
          if (data && data.id) {
            resolve(data);
          } else {
            reject(new Error('Invalid transport response'));
          }
        };

        this.socket.once('transport-created', onCreated);
        this.socket.emit('create-transport', { roomId });

        // Timeout safety
        setTimeout(() => {
          this.socket.off('transport-created', onCreated);
          reject(new Error('Transport creation timed out'));
        }, 5000);
      });

      console.log('Transport created on server:', transportInfo.id);

      // Now request server to create a producer associated with that transport
      // Only send the essential parameters that mediasoup needs
      const rtpParameters = {
        codecs: parameters.codecs || [],
        encodings: parameters.encodings || [],
        headerExtensions: parameters.headerExtensions || [],
        rtcp: parameters.rtcp || {}
      };
      
      // Ensure codecs have the proper format
      if (rtpParameters.codecs && rtpParameters.codecs.length > 0) {
        rtpParameters.codecs.forEach(codec => {
          // Make sure mimeType is in the correct format
          if (codec.mimeType && typeof codec.mimeType === 'string') {
            // Ensure it's in format like 'audio/opus', 'video/VP8', etc.
            if (!codec.mimeType.includes('/')) {
              console.warn('Invalid codec mimeType format:', codec.mimeType);
            }
          }
        });
      }
      
      const produced = await new Promise((resolve, reject) => {
        const onProduced = (data) => {
          if (data && data.id) {
            resolve(data);
          } else {
            reject(new Error('Invalid produced response'));
          }
        };

        this.socket.once('produced', onProduced);

        this.socket.emit('produce', {
          roomId,
          transportId: transportInfo.id,
          kind: 'audio',
          rtpParameters
        });

        // Timeout safety
        setTimeout(() => {
          this.socket.off('produced', onProduced);
          reject(new Error('Produce request timed out'));
        }, 5000);
      });

      console.log('Producer successfully created on server:', produced.id);

      // Store producer ID for reference
      this.producerId = produced.id;

      return produced;
    } catch (error) {
      console.error('Error creating producer:', error.message || error);
      // Do not surface this to recording error flow directly — production might be retried later when in a call
    }
  }
  */

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

  // Start local recording the call (real audio recording from microphone)


  // Start sending local audio to server (mediasoup send-only transport)
  async startSendToServer() {
    try {
      // Check if already sending to server to prevent multiple producers
      if (this.sendTransport && this.producer && !this.producer.closed) {
        console.log('[send] already sending to server, skip');
        return true;
      }
      
      let Device;
      try {
        Device = require('mediasoup-client').Device;
      } catch (e) {
        console.error('mediasoup-client not installed or failed to load:', e);
        return false;
      }

      // Fetch router RTP capabilities with retries and better logging
      const getRouterCaps = async (tries = 3, delayMs = 750) => {
        for (let attempt = 1; attempt <= tries; attempt++) {
          try {
            if (!this.socket || !this.socket.connected) {
              console.log('[send] socket not connected, waiting for connect...');
              await new Promise((resolve) => this.socket.once('connect', resolve));
            }

                  console.log(`[send] requesting router RTP capabilities (attempt ${attempt}/${tries})`);
            this.socket.emit('get-router-rtp-capabilities');

            const res = await new Promise((resolve, reject) => {
              const t = setTimeout(() => reject(new Error('router caps timeout')), 3000);
              this.socket.once('router-rtp-capabilities', (d) => { clearTimeout(t); resolve(d); });
            });

            console.log('[send] router caps reply:', { pid: res && res.pid, socketId: res && res.socketId, remoteAddr: res && res.remoteAddr, ready: res && res.ready, message: res && res.message });

            if (res && res.ready) return res.caps;

            // If server replied that router is not ready, log and treat as failure for retry
            if (res && !res.ready) {
              console.warn('[send] server reports router not ready:', res.message);
            }
          } catch (err) {
            console.warn(`[send] get-router-rtp-capabilities attempt ${attempt} failed:`, err && err.message ? err.message : err);
            if (attempt < tries) await new Promise((r) => setTimeout(r, delayMs));
          }
        }
        throw new Error('router caps timeout');
      }
      
      // Clean up any existing transport before creating a new one
      await this.stopSendToServer();
            
      let caps;
      try {
        caps = await getRouterCaps(3, 750);
      } catch (err) {
        console.warn('[send] socket caps attempts failed, trying HTTP fallback:', err && err.message ? err.message : err);
        // Try HTTP fallback to debug endpoint
        try {
          const base = (this.socket && this.socket.io && this.socket.io.uri) ? this.socket.io.uri : 'http://34.179.130.224:3500';
          const url = `${base.replace(/\/$/, '')}/debug/router-rtp-capabilities`;
          console.log('[send] fetching router capabilities via HTTP fallback:', url);
          const r = await fetch(url, { method: 'GET' });
          const json = await r.json();
          if (json && json.ready) {
            caps = json.caps;
          } else {
            throw new Error('HTTP fallback: router not ready');
          }
        } catch (httpErr) {
          console.error('[send] HTTP fallback failed:', httpErr && httpErr.message ? httpErr.message : httpErr);
          throw httpErr;
        }
      }

      const device = new Device();
      await device.load({ routerRtpCapabilities: caps }); // may throw if caps invalid

      const roomId = this.getCanonicalRoomId(this.currentCallTarget);

      // create transport on server
      this.socket.emit('create-transport', { roomId });
      const transportParams = await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('create-transport timeout')), 5000);
        this.socket.once('transport-created', (p) => { clearTimeout(t); resolve(p); });
      });

      this.sendDevice = device;
      this.sendTransport = device.createSendTransport(transportParams);

      this.sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        const transportId = transportParams.id;

        let done = false;
        const onConnected = (payload) => {
          // payload может быть { transportId }
          if (!payload || payload.transportId !== transportId) return;

          if (done) return;
          done = true;

          clearTimeout(timer);
          this.socket.off('transport-connected', onConnected);
          callback();
        };

        const timer = setTimeout(() => {
          if (done) return;
          done = true;
          this.socket.off('transport-connected', onConnected);
          errback(new Error('transport connect timed out'));
        }, 15000); // 15s лучше, особенно на мобиле/сервере

        this.socket.on('transport-connected', onConnected);
        this.socket.emit('connect-transport', { roomId, transportId, dtlsParameters });
      });

      this.sendTransport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
        this.socket.emit('produce', { roomId, transportId: transportParams.id, kind, rtpParameters });
        this.socket.once('produced', (d) => callback({ id: d.id }));
      });

      const stream = this.localStream || await this.initializeMediaDevices();
      const track = stream && stream.getAudioTracks()[0];
      if (!track) {
        console.error('No local audio track to produce');
        return false;
      }

      this.producer = await this.sendTransport.produce({ track });
      console.log('Produced track to server:', this.producer.id);
      
      // Set producerId after startSendToServer completes, as recommended
      this.producerId = this.producer.id;
      
      return true;
    } catch (err) {
      console.error('startSendToServer failed:', err);
      return false;
    }
  }

  async stopSendToServer() {
    try {
      if (this.producer) {
        try { this.producer.close(); } catch(e) {}
        this.producer = null;
      }
      if (this.sendTransport) {
        try { this.sendTransport.close(); } catch(e) {}
        this.sendTransport = null;
      }
      this.sendDevice = null;
      return true;
    } catch (err) {
      console.error('stopSendToServer failed:', err);
      return false;
    }
  }

  // Get recording status
  getRecordingStatus() {
    return this.recordingManager.getRecordingStatus();
  }

  // Start server-side recording
  async startServerRecording(callId) {
    try {
      console.log('Starting server recording for call:', callId);
      
      // Wait for connection to be fully established before starting recording
      const maxRetries = 10;
      let retries = 0;
      
      while (!this.isAudioAvailable() && retries < maxRetries) {
        console.log(`Waiting for connection to establish... Retry ${retries + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 300)); // Wait 300ms between checks
        retries++;
      }
      
      // Final check
      if (!this.isAudioAvailable()) {
        const errorMsg = 'Cannot start recording - audio not available. Please ensure the call is connected before starting recording.';
        console.error(errorMsg);
        if (this.onServerRecordingError) {
          this.onServerRecordingError({ error: errorMsg, retryable: false });
        }
        return { success: false, error: errorMsg, retryable: false };
      }
      
      // Additional check: ensure both parties are sending audio to server before starting recording
      if (!this.producerId) {
        const errorMsg = 'Cannot start recording - not sending audio to server. Please ensure both parties are connected and sending audio to the server.';
        console.error(errorMsg);
        if (this.onServerRecordingError) {
          this.onServerRecordingError({ error: errorMsg, retryable: true });
        }
        return { success: false, error: errorMsg, retryable: true };
      }

      // For recording, we should use existing producers from the call
      // Don't try to create a new producer, just ensure we wait for existing ones
      if (!this.producerId) {
        console.log('No producer ID set locally, but we should wait for existing call producers instead of creating new ones');
        // We'll rely on the server-side check below to ensure producers exist
      } else {
        console.log('Using existing producer ID for recording:', this.producerId);
      }

      // Ensure the server has producers for this call before requesting recording
      const canonicalRoom = this.getCanonicalRoomId(callId);
      console.log(`Polling server for producers before starting recording for room ${canonicalRoom}...`);
      const serverHasProducers = await this.waitForServerProducers(canonicalRoom, 15000, 500);
      if (!serverHasProducers) {
        const errorMsg = 'Cannot start recording - server has no producers for this call. This usually means the media track isn\'t published to the server yet.';
        console.error(errorMsg);
        if (this.onServerRecordingError) {
          this.onServerRecordingError({ error: errorMsg, retryable: true });
        }
        return { success: false, error: errorMsg, retryable: true };
      }
      
      // Try to start recording with retry mechanism for retryable errors
      const maxRecordingRetries = 3;
      let recordingRetries = 0;
      
      // Use canonicalRoom (e.g., 13-7) instead of callId (e.g., 13) for recording
      const result = await this.recordingManager.startServerRecording(canonicalRoom, 30000); // 20 second timeout to allow for FFmpeg startup
      
      // Handle the result
      if (result.success) {
        this.isServerRecording = true;
        console.log('Server recording started successfully');
      } else if (result.error) {
        console.error('Server recording failed:', result.error);
        if (result.error.includes('Recording service unavailable') || result.error.includes('mediasoup-recording not initialized')) {
          // Show user-friendly message about recording not available
          console.log('Recording service unavailable - showing user message');
          if (this.onServerRecordingError) {
            this.onServerRecordingError({ error: 'Recording service is not available at this time', retryable: false });
          }
        } else if (result.error.includes('no audio producers available')) {
          // Show user-friendly message about no audio producers
          console.log('No audio producers available - showing user message');
          if (this.onServerRecordingError) {
            this.onServerRecordingError({ error: 'No audio producers available - make sure both parties are connected to the call', retryable: true });
          }
        }
      }
      
      // The server recording started event is handled by the socket listener
      // No need to call onServerRecordingStarted() here since it's already called from setupServerRecordingListeners
      
      return result;
      
      // If we get here, we've exhausted our retries
      const errorMsg = 'Failed to start server recording after multiple attempts. Please try again.';
      console.error(errorMsg);
      if (this.onServerRecordingError) {
        this.onServerRecordingError(new Error(errorMsg));
      }
      return { success: false, error: errorMsg };
    } catch (error) {
      console.error('Server recording error:', error);
      if (this.onServerRecordingError) {
        this.onServerRecordingError(error);
      }
      return { success: false, error: `Server recording failed: ${error.message}` };
    }
  }

  // Stop server-side recording
  async stopServerRecording(callId) {
    try {
      console.log('Stopping server recording for call:', callId);
      const canonicalRoom = this.getCanonicalRoomId(callId);
      const result = await this.recordingManager.stopServerRecording(canonicalRoom, 30000); // 20 second timeout to allow for FFmpeg shutdown

      if (result.success && this.onServerRecordingStopped) {
        this.onServerRecordingStopped();
      }

      return result;
    } catch (error) {
      console.error('Server recording error:', error);
      if (this.onServerRecordingError) {
        this.onServerRecordingError(error);
      }
      return { success: false, error: `Server recording failed: ${error.message}` };
    }
  }

  // Download server recording
  async downloadServerRecording(downloadUrl, fileName) {
    return await this.recordingManager.downloadServerRecording(downloadUrl, fileName);
  }

  // Setup server recording event listeners
  setupServerRecordingListeners() {
    // Listen for server recording started confirmation
    this.socket.on('recording-started', (data) => {
      console.log('Server recording started:', data);
      const result = this.recordingManager.handleServerRecordingStarted(data);
      this.isServerRecording = true; // Set server recording flag
      if (this.onServerRecordingStarted) {
        this.onServerRecordingStarted(result);
      }
    });

    // Listen for server recording stopped with result
    this.socket.on('recording-stopped', async (data) => {
      console.log('Server recording stopped:', data);
      const result = this.recordingManager.handleServerRecordingStopped(data);
      this.isServerRecording = false; // Reset server recording flag
      if (this.onServerRecordingStopped) {
        this.onServerRecordingStopped(result);
      }
    });

    // Listen for server recording errors
    this.socket.on('error', (data) => {
      // Filter out non-recording, non-critical errors like produce failures
      if (data && data.message && data.message.includes('Failed to produce')) {
        console.warn('Received produce-related error (ignored for recording flow):', data);
        return;
      }

      console.error('Server recording error:', data);
      const result = this.recordingManager.handleServerRecordingError(data);
      if (this.onServerRecordingError) {
        this.onServerRecordingError(result);
      }
    });

    // Listen specifically for produce errors (more granular handling)
    this.socket.on('produce-error', (data) => {
      console.warn('Produce failed on server:', data);
      // Do not treat this as a server recording failure; production may be attempted later when in-call
    });
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

  // Check if audio is actually available for recording
  isAudioAvailable() {
    // Primary check: do we have local audio tracks and a connected peer connection?
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks && audioTracks.length > 0) {
        // Check if peer connection is in a connected state
        // We allow 'connected' or 'connecting' states, and also check if we have a server producer
        if (this.peerConnection && 
            (this.peerConnection.connectionState === 'connected' || 
             this.peerConnection.connectionState === 'connecting' ||
             this.peerConnection.iceConnectionState === 'connected' ||
             this.peerConnection.iceConnectionState === 'connecting')) {
          // If we have local audio tracks and connection is established/connecting, we have audio available
          // Additionally, check if we're actually sending audio to the server via mediasoup
          if (this.producerId) {
            console.log('Audio available: server-side producer exists:', this.producerId);
            return true;
          }
        }
      }
    }
    
    // Fallback: if we have a server-side producer, we can record
    // This handles cases where audio is flowing through mediasoup even if local state is not fully synchronized
    if (this.producerId) {
      console.log('Audio available: server-side producer exists:', this.producerId);
      return true;
    }
    
    // Additional fallback: if we're in a call and have set the flag, consider audio available
    if (this.isInCall) {
      console.log('Audio available: call is established (isInCall=true)');
      return true;
    }
    
    return false;
  }

  // Poll the server to check whether the room has producers
  async waitForServerProducers(callId, timeoutMs = 10000, pollInterval = 500) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const producersCount = await new Promise((resolve, reject) => {
          const onResponse = (data) => {
            if (data && data.callId === callId) {
              resolve(data.producersCount || 0);
            }
          };

          // Set up a one-time listener
          this.socket.once('room-producers', onResponse);

          // Ask server for producers immediately
          this.socket.emit('get-room-producers', { roomId: callId });

          // Timeout safety for this request
          setTimeout(() => {
            this.socket.off('room-producers', onResponse);
            resolve(0);
          }, pollInterval - 50);
        });

        if (producersCount > 0) {
          console.log(`Server reports ${producersCount} producers for call ${callId}`);
          return true;
        }
      } catch (err) {
        console.warn('Error while polling server for producers:', err.message || err);
      }

      // Wait before next poll
      await new Promise((r) => setTimeout(r, pollInterval));
    }

    return false;
  }



  // Check if caller
  getIsCaller() {
    return this.isCaller;
  }
}

export default WebRTCService;
# CallApp - Audio Calling Application

A React Native application that enables audio calling between users using WebRTC technology.

## Features

- Audio calling between users
- Mute/unmute functionality
- Speakerphone toggle
- Call rejection/acceptance
- Real-time communication using WebRTC
- Tab-based navigation interface

## Technologies Used

- React Native
- WebRTC (react-native-webrtc)
- Socket.IO for signaling
- Node.js Express server
- React Navigation for tab navigation

## Prerequisites

- Node.js (version 16 or higher)
- npm or yarn
- Android Studio or Xcode for mobile development
- Two devices/emulators for testing calling functionality

## Setup Instructions

### 1. Install Dependencies

```bash
# Install React Native dependencies
npm install

# Install server dependencies
cd server
npm install
```

### 2. Start the Signaling Server

```bash
cd server
npm start
```

The server will start on port 3000.

### 3. Update Server IP (if needed)

In `App.tsx`, update the Socket.IO connection URL to match your server IP:

```javascript
const newSocket = io('http://YOUR_SERVER_IP:3000');
```

### 4. Run the Mobile App

For Android:
```bash
npx react-native run-android
```

For iOS:
```bash
npx react-native run-ios
```

## How to Use

1. Start the app on two different devices/emulators
2. Note the User ID displayed on each device
3. Enter one device's User ID on the other device to initiate a call
4. Accept the incoming call on the receiving device
5. Use the call controls to mute/unmute or end the call

## Project Structure

```
CallApp/
├── src/
│   └── components/
│       ├── MainScreen.js             # Main screen with tab navigation
│       ├── ChatsScreen.js            # Chats interface
│       ├── DialerScreen.tsx          # Main dialer interface
│       ├── CallScreen.tsx            # Active call screen
│       └── IncomingCallScreen.tsx    # Incoming call screen
├── server/
│   ├── server.js                     # Signaling server
│   └── package.json                  # Server dependencies
├── App.tsx                           # Main application component
└── index.js                          # Entry point
```

## Network Connectivity

This application uses WebRTC for peer-to-peer audio communication. The connection process works as follows:

1. **STUN Servers**: Used to discover public IP addresses when both devices are on different networks but have direct internet access.

2. **TURN Servers**: Used as relay servers when direct peer-to-peer connections are not possible due to NATs or firewalls. The app includes several public TURN servers for this purpose.

3. **Connection Process**:
   - Devices exchange signaling information through the Socket.IO server
   - Devices attempt direct P2P connection using STUN
   - If direct connection fails, TURN servers are used as relays

## Production Considerations

1. **TURN Server**: For production, deploy a dedicated TURN server to handle NAT traversal when direct peer-to-peer connections aren't possible. Public TURN servers may be unreliable or have limited capacity.

2. **Security**: Implement authentication and encryption for signaling messages.

3. **Push Notifications**: Integrate push notifications for incoming calls when the app is in the background.

4. **Error Handling**: Add more robust error handling for network issues and WebRTC failures.

## Troubleshooting

- If calls don't connect across different networks, ensure proper TURN server configuration
- Check that the signaling server is running and accessible from both devices
- Verify microphone permissions are granted to the app
- Network firewalls or restrictive NATs may prevent connections
- For best results, test with physical devices rather than emulators

## License

This project is licensed under the MIT License.
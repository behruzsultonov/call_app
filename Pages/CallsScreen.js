import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Header from '../components/Header';
import { useWebRTC } from '../contexts/WebRTCContext';

// DialPad Component
const DialPad = ({ onPressDigit, onClose, onCall, onDelete }) => {
  const digits = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];

  return (
    <View style={styles.dialPadContainer}>
      {/* DIGITS GRID */}
      {digits.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => onPressDigit && onPressDigit(d)}
              style={styles.key}
            >
              <Text style={styles.keyText}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      {/* BOTTOM BAR */}
      <View style={styles.bottomRow}>
        
        {/* CLOSE */}
        <TouchableOpacity onPress={onClose} style={styles.bottomButtonLeft}>
          <Text style={styles.closeText}>Закрыть</Text>
        </TouchableOpacity>

        {/* CALL BUTTON */}
        <TouchableOpacity onPress={onCall} style={styles.callButton}>
          <Icon name="call" size={26} color="#fff" />
        </TouchableOpacity>

        {/* DELETE BUTTON */}
        <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
          <Icon name="backspace" size={24} color="#a3a3a3" />
        </TouchableOpacity>

      </View>
    </View>
  );
};

const CallsScreen = ({ navigation }) => {
  const [showDialer, setShowDialer] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const { userId, makeCall, callStatus } = useWebRTC();

  // Navigate to call screen when call is initiated
  useEffect(() => {
    if (callStatus === 'calling' || callStatus === 'incoming') {
      navigation.navigate('Call');
    }
  }, [callStatus, navigation]);

  const toggleDialer = () => {
    setShowDialer(!showDialer);
    if (showDialer) {
      setPhoneNumber(''); // Clear phone number when closing dialer
    }
  };

  const handleNumberPress = (number) => {
    // Only allow 4 digits for user ID
    if (phoneNumber.length < 4 || number === '*' || number === '#') {
      setPhoneNumber(phoneNumber + number);
    }
  };

  const handleDelete = () => {
    setPhoneNumber(phoneNumber.slice(0, -1));
  };

  const handleCall = async () => {
    // Validate that we have a 4-digit number
    if (phoneNumber.length !== 4 || !/^\d{4}$/.test(phoneNumber)) {
      Alert.alert('Invalid Number', 'Please enter a valid 4-digit user ID');
      return;
    }

    try {
      // Make the call using WebRTC context
      await makeCall(phoneNumber);
    } catch (error) {
      console.error('Error making call:', error);
      Alert.alert('Call Failed', 'Failed to initiate call. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Calls" />
      
      {!showDialer ? (
        <>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Today is a great day to call</Text>
            <Text style={styles.userIdText}>
              Your User ID: {userId || 'Loading...'}
            </Text>
          </View>
          <TouchableOpacity style={styles.fab} onPress={toggleDialer}>
            <Icon name="dialpad" size={24} color="#fff" />
          </TouchableOpacity>
        </>
      ) : (
        // Dialer UI with the new DialPad component
        <View style={styles.dialerContainer}>
          {/* Phone number display */}
          <View style={styles.phoneNumberContainer}>
            <TextInput
              style={styles.phoneNumberText}
              value={phoneNumber}
              editable={false}
              placeholder="Enter 4-digit ID"
            />
          </View>
          
          {/* DialPad Component */}
          <DialPad
            onPressDigit={handleNumberPress}
            onClose={toggleDialer}
            onCall={handleCall}
            onDelete={handleDelete}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

export default CallsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: 'gray' },
  userIdText: { 
    fontSize: 14, 
    color: '#D88A22', 
    marginTop: 20,
    fontWeight: 'bold'
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#f08c00',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  
  // Dialer styles
  dialerContainer: {
    flex: 1,
    backgroundColor: '#fafafa', // Changed to light gray background
  },
  
  phoneNumberContainer: {
    paddingVertical: 5, // Further reduced vertical padding
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    height: 60,
    justifyContent: 'center',
  },
  
  phoneNumberText: {
    fontSize: 28,
    textAlign: 'center',
    color: '#000',
    fontWeight: '300',
    includeFontPadding: false, // Remove extra font padding
    textAlignVertical: 'center', // Center text vertically
  },
  
  // DialPad styles
  dialPadContainer: {
    paddingVertical: 20,
    backgroundColor: "#fff",
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  /* DIGITS BUTTONS GRID */
  row: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginVertical: 8,
  },

  key: {
    width: 70,
    height: 55,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#f5f5f5", // Changed to light gray to match other screens
  },
  keyText: {
    fontSize: 24,
    color: "#333", // Changed to dark gray for better contrast
    fontWeight: "500",
  },

  /* BOTTOM BAR */
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    justifyContent: "space-between",
    paddingHorizontal: 25,
  },

  bottomButtonLeft: {
    paddingVertical: 10,
  },
  closeText: {
    fontSize: 16,
    color: "#D88A22", // Changed to match the accent color used in other screens
  },

  callButton: {
    width: 60,
    height: 60,
    backgroundColor: "#D88A22", // Changed to match the accent color used in other screens
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },

  deleteButton: {
    padding: 10,
  },
});
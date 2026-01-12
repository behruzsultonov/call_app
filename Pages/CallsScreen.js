import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, TextInput, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Header from '../components/Header';
import { useWebRTC } from '../contexts/WebRTCContext';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/Client'; // Import the API client
import AsyncStorage from '@react-native-async-storage/async-storage';


// DialPad Component
const DialPad = ({ onPressDigit, onClose, onCall, onDelete, t, theme }) => {
  const digits = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];

  return (
    <View style={[styles.dialPadContainer, { backgroundColor: theme.cardBackground }]}>
      {/* DIGITS GRID */}
      {digits.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => onPressDigit && onPressDigit(d)}
              style={[styles.key, { backgroundColor: theme.inputBackground }]}
            >
              <Text style={[styles.keyText, { color: theme.text }]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      {/* BOTTOM BAR */}
      <View style={styles.bottomRow}>
        
        {/* CLOSE */}
        <TouchableOpacity onPress={onClose} style={styles.bottomButtonLeft}>
          <Text style={[styles.closeText, { color: theme.primary }]}>{t('close')}</Text>
        </TouchableOpacity>

        {/* CALL BUTTON */}
        <TouchableOpacity onPress={onCall} style={[styles.callButton, { backgroundColor: theme.primary }]}>
          <Icon name="call" size={26} color={theme.buttonText} />
        </TouchableOpacity>

        {/* DELETE BUTTON */}
        <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
          <Icon name="backspace" size={24} color={theme.textSecondary} />
        </TouchableOpacity>

      </View>
    </View>
  );
};

const CallsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [showDialer, setShowDialer] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [actualUserId, setActualUserId] = useState(null);
  
  const { userId, makeCall, callStatus, setCallHistoryRefreshCallback } = useWebRTC();
  
  // Load actual user ID from AsyncStorage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userDataString = await AsyncStorage.getItem('userData');
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          setActualUserId(userData.id ? userData.id.toString() : null);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, []);

  const [callHistory, setCallHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch call history from API
  
  // Fetch call history from API
  useEffect(() => {
    if (actualUserId) {
      fetchCallHistory();
    }
  }, [actualUserId]);
  
  // Set up callback to refresh call history when a call is saved
  useEffect(() => {
    if (setCallHistoryRefreshCallback && actualUserId) {
      setCallHistoryRefreshCallback(() => {
        console.log('Refreshing call history after call ended');
        fetchCallHistory();
      });
    }
  }, [setCallHistoryRefreshCallback, actualUserId]);
  
  const deleteCall = async (callId) => {
    Alert.alert(
      t('confirmDelete'),
      t('deleteCallConfirmation'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.deleteCall(callId, actualUserId);
              
              if (response.data.success) {
                // Refresh the call history to reflect the deletion
                fetchCallHistory();
              } else {
                console.error('Failed to delete call:', response.data.message);
                Alert.alert(t('error'), response.data.message || t('failedToDeleteCall'));
              }
            } catch (error) {
              console.error('Error deleting call:', error);
              Alert.alert(t('error'), t('failedToDeleteCall'));
            }
          }
        }
      ]
    );
  };
  
  const fetchCallHistory = async () => {
    try {
      setLoading(true);
      console.log('Fetching call history for user ID:', actualUserId);
      const response = await api.getCallHistory(actualUserId);
      
      console.log('Call history response:', response.data);
      
      if (response.data.success) {
        setCallHistory(response.data.data || []);
      } else {
        console.error('Failed to fetch call history:', response.data.message || 'Unknown error');
        setCallHistory([]);
      }
    } catch (error) {
      console.error('Error fetching call history:', error);
      console.error('Error details:', error.message || error);
      setCallHistory([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Цвета статусов
  const statusColors = {
    missed: "#d9534f",
    outgoing: "#d88a22",
    incoming: "#28a745",
  };
  
  // Название статусов
  const statusLabels = {
    missed: "Пропущенный звонок",
    outgoing: "Исходящий звонок",
    incoming: "Входящий звонок",
  };
  
  // Иконки статусов
  const statusIcons = {
    missed: "call-missed",
    outgoing: "call-made",
    incoming: "call-received",
  };
  
  const renderCallItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.callRow, { borderBottomColor: theme.border }]}
      onPress={() => navigation.navigate('CallInfo', { phoneNumber: item.number })}
      onLongPress={() => {
        Alert.alert(
          t('deleteCall'),
          t('deleteCallConfirmation'),
          [
            { text: t('cancel'), style: 'cancel' },
            {
              text: t('delete'),
              style: 'destructive',
              onPress: () => deleteCall(item.id)
            }
          ]
        );
      }}
    >
      {/* Аватар */}
      <View style={styles.avatar}>
        <Icon name="person" size={34} color={theme.textSecondary} />
      </View>
  
      {/* Контент */}
      <View style={styles.callContent}>
        <Text style={[styles.phone, { color: theme.text }]}>{item.number}</Text>
  
        <View style={styles.statusRow}>
          <Icon
            name={statusIcons[item.type]}
            size={18}
            color={statusColors[item.type]}
          />
          <Text style={[styles.statusText, { color: statusColors[item.type] }]}>            
            {statusLabels[item.type]}
          </Text>
        </View>
  
        <Text style={[styles.time, { color: theme.textSecondary }]}>{item.time}</Text>
      </View>
  
      {/* Кнопка звонка */}
      <TouchableOpacity style={[styles.listCallButton, { backgroundColor: theme.primary }]}>        
        <Icon name="call" size={20} color={theme.buttonText} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

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
    // Allow entering phone numbers of reasonable length
    if (phoneNumber.length < 20) {
      setPhoneNumber(phoneNumber + number);
    }
  };

  const handleDelete = () => {
    setPhoneNumber(phoneNumber.slice(0, -1));
  };

  const handleCall = async () => {
    // Validate that we have a phone number entered
    if (!phoneNumber || phoneNumber.length < 3) {
      Alert.alert(t('invalidNumber'), t('pleaseEnterPhoneNumber'));
      return;
    }

    // Additional validation for phone number format (basic check)
    // Allow phone numbers with or without country codes
    const phoneRegex = /^[0-9+\-\s\(\)]+$/;
    if (!phoneRegex.test(phoneNumber)) {
      Alert.alert(t('invalidNumber'), t('invalidPhoneNumber'));
      return;
    }

    try {
      // First, check if the user exists in the database by phone number
      const response = await api.getUserByPhoneNumber(phoneNumber);
      
      if (response.data.success && response.data.data) {
        // Get the user object
        const user = response.data.data;
        
        if (user && user.id) {
          // Check if there's a bidirectional block between users before making the call
          const userDataString = await AsyncStorage.getItem('userData');
          if (userDataString) {
            const currentUser = JSON.parse(userDataString);
            
            const blockCheckResponse = await api.checkBlockedStatus(currentUser.id, user.id);
            
            if (blockCheckResponse.data.success && blockCheckResponse.data.data && blockCheckResponse.data.data.is_blocked) {
              Alert.alert(t('blocked'), t('cannotCallBlockedUser'));
              return;
            }
          }
          
          // User exists, proceed with the call using their actual user ID
          await makeCall(user.id.toString(), phoneNumber, false); // Pass the phone number as well, and set isVideoCall to false for audio-only call
        } else {
          // User doesn't exist, show error message
          Alert.alert(t('userNotFound'), t('userDoesNotExist'));
        }
      } else {
        // User doesn't exist, show error message
        Alert.alert(t('userNotFound'), t('userDoesNotExist'));
      }
    } catch (error) {
      console.error('Error checking user or making call:', error);
      Alert.alert(t('callFailed'), t('failedToInitiateCall'));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title={t('calls')} />
      
      {!showDialer ? (
        <>
          {/* Your ID */}
          <View style={[styles.idContainer, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.idLabel, { color: theme.textSecondary }]}>{t('yourId')}:</Text>
            <Text style={[styles.idValue, { color: theme.primary }]}>
              {actualUserId || (userId ? String(userId).padStart(4, '0') : t('loading'))}
            </Text>
          </View>

          {/* LIST */}
          <FlatList
            data={callHistory}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderCallItem}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              loading ? (
                <View style={[styles.emptyContainer, { backgroundColor: theme.cardBackground }]}> 
                  <Text style={[styles.emptyText, { color: theme.text }]}>Loading...</Text>
                </View>
              ) : (
                <View style={[styles.emptyContainer, { backgroundColor: theme.cardBackground }]}> 
                  <Text style={[styles.emptyText, { color: theme.text }]}>{t('noCallHistory')}</Text>
                </View>
              )
            }
          />

          <TouchableOpacity style={[styles.fab, { backgroundColor: theme.primary }]} onPress={toggleDialer}>
            <Icon name="dialpad" size={24} color={theme.buttonText} />
          </TouchableOpacity>
        </>
      ) : (
        // Dialer UI with the new DialPad component
        <View style={[styles.dialerContainer, { backgroundColor: theme.background }]}>
          {/* Phone number display */}
          <View style={[styles.phoneNumberContainer, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
            <TextInput
              style={[styles.phoneNumberText, { color: theme.text }]}
              value={phoneNumber}
              editable={false}
              placeholder={t('enter4DigitId')}
              placeholderTextColor={theme.placeholder}
            />
          </View>
          
          {/* DialPad Component */}
          <DialPad
            t={t}
            theme={theme}
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
  
  // List Header
  listHeader: {
    height: 60,
    backgroundColor: '#fff',
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 20,
    color: "#d88a22",
    fontWeight: "bold",
  },
  
  // User ID Container
  idContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#fff'
  },
  idLabel: {
    fontSize: 16,
    color: "#777",
  },
  idValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#d88a22",
  },
  
  // Call Row Styles
  callRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f1f1",
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e5e5e5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  callContent: {
    flex: 1,
  },

  phone: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },

  statusText: {
    marginLeft: 4,
    fontSize: 14,
  },

  time: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
  },

  listCallButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#d88a22",
    justifyContent: "center",
    alignItems: "center",
  },
  
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#777',
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


});
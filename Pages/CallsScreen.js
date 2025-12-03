import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, TextInput, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Header from '../components/Header';
import { useWebRTC } from '../contexts/WebRTCContext';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

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
  
  const { userId, makeCall, callStatus } = useWebRTC();
  
  // Call data
  const calls = [
    {
      id: "1",
      number: "992987654321",
      type: "missed",
      time: "20:36",
    },
    {
      id: "2",
      number: "992987654321",
      type: "missed",
      time: "20:36",
    },
    {
      id: "3",
      number: "985580777",
      type: "outgoing",
      time: "20:34",
    },
    {
      id: "4",
      number: "985580777",
      type: "incoming",
      time: "20:33",
    },
    {
      id: "5",
      number: "985580777",
      type: "outgoing",
      time: "20:33",
    },
  ];
  
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
      Alert.alert(t('invalidNumber'), t('enterValid4DigitId'));
      return;
    }

    try {
      // Make the call using WebRTC context
      await makeCall(phoneNumber);
    } catch (error) {
      console.error('Error making call:', error);
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
              {userId ? String(userId).padStart(4, '0') : t('loading')}
            </Text>
          </View>

          {/* LIST */}
          <FlatList
            data={calls}
            keyExtractor={(item) => item.id}
            renderItem={renderCallItem}
            contentContainerStyle={{ paddingBottom: 100 }}
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
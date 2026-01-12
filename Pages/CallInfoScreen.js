import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

export default function CallInfoScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { phoneNumber } = route.params || {};
  const [callHistory, setCallHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchCallHistory();
  }, [phoneNumber]);
  
  const fetchCallHistory = async () => {
    try {
      setLoading(true);
      
      // Get the actual user ID
      const userDataString = await AsyncStorage.getItem('userData');
      if (!userDataString) {
        console.error('User data not found');
        setLoading(false);
        return;
      }
      
      const userData = JSON.parse(userDataString);
      const actualUserId = userData.id;
      
      // First, try to find the contact by phone number
      let userResponse = await api.getUserByPhoneNumber(phoneNumber);
      let targetUser = null;
      
      if (userResponse.data.success && userResponse.data.data) {
        targetUser = userResponse.data.data;
      } else {
        // If not found by phone number, try to find by username
        userResponse = await api.getUserByUsername(phoneNumber);
        if (userResponse.data.success && userResponse.data.data) {
          targetUser = userResponse.data.data;
        }
      }
      
      if (!targetUser) {
        console.error('User not found for phone number/username:', phoneNumber);
        setLoading(false);
        return;
      }
      
      const targetUserId = targetUser.id;
      
      // Now get the call history for both users (to get calls between them)
      const response = await api.getCallHistory(actualUserId);
      
      if (response.data.success) {
        // Filter calls to only include calls with the specific contact
        const filteredCalls = response.data.data.filter(call => 
          call.number === phoneNumber || 
          call.number === targetUser.phone_number ||
          call.number === targetUser.username
        );
        
        setCallHistory(filteredCalls);
      } else {
        console.error('Failed to fetch call history:', response.data.message);
        setCallHistory([]);
      }
    } catch (error) {
      console.error('Error fetching call history:', error);
      setCallHistory([]);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.primary }]}>Звонок</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Contact Info */}
      <View style={[styles.contactContainer, { borderBottomColor: theme.border }]}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Text style={styles.avatarText}>
            {phoneNumber ? phoneNumber.slice(-1) : '1'}
          </Text>
        </View>
        <Text style={[styles.phoneNumber, { color: theme.text }]}>
          {phoneNumber || '992987654321'}
        </Text>
        <TouchableOpacity style={[styles.callBtn, { backgroundColor: theme.primary }]}>
          <Icon name="call" size={24} color={theme.buttonText} />
        </TouchableOpacity>
      </View>

      {/* History */}
      <ScrollView style={{ marginTop: 10 }}>
        {loading ? (
          <Text style={[styles.sectionTitle, { color: theme.textSecondary, padding: 16 }]}>{t('loading')}...</Text>
        ) : callHistory.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary, paddingHorizontal: 16 }]}>{t('callHistory')}</Text>
            {callHistory.map((call, index) => (
              <View key={`${call.id}-${index}`} style={[styles.item, { borderBottomColor: theme.border }]}>  
                <Icon 
                  name={getStatusIconName(call.type)} 
                  size={20} 
                  color={getStatusIconColor(call.type)} 
                />
                <View style={styles.itemInfo}>
                  <Text style={[styles.time, { color: theme.text }]}>{call.time}</Text>
                  {call.duration ? (
                    <View style={styles.row}>
                      <Icon name="call" size={16} color={theme.textSecondary} />
                      <Text style={[styles.duration, { color: theme.textSecondary }]}>{call.duration}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </>
        ) : (
          <Text style={[styles.sectionTitle, { color: theme.textSecondary, padding: 16 }]}>{t('noCallHistory')}</Text>
        )}
      </ScrollView>
    </View>
  );
}

// Helper function to get icon name based on call type
function getStatusIconName(callType) {
  switch (callType) {
    case 'outgoing':
      return 'call-made'; // Arrow pointing up-right for outgoing
    case 'missed':
      return 'call-missed';
    case 'incoming':
      return 'call-received'; // Arrow pointing down-left for incoming
    default:
      return 'call';
  }
}

// Helper function to get icon color based on call type
function getStatusIconColor(callType) {
  switch (callType) {
    case 'missed':
      return '#E04A4A'; // Red for missed
    case 'outgoing':
      return '#4CAF50'; // Green for outgoing
    case 'incoming':
      return '#2196F3'; // Blue for incoming
    default:
      return '#777';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  headerTitle: {
    fontSize: 20,
    color: '#D68B1F',
    fontWeight: '600'
  },
  contactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#D68B1F',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  },
  phoneNumber: {
    flex: 1,
    marginLeft: 15,
    fontSize: 18,
    fontWeight: '500',
    color: '#000'
  },
  callBtn: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: '#D68B1F',
    justifyContent: 'center',
    alignItems: 'center'
  },
  sectionTitle: {
    paddingHorizontal: 16,
    color: '#7B7B7B',
    marginBottom: 10
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  itemInfo: {
    marginLeft: 12
  },
  time: {
    fontSize: 16,
    color: '#000',
    marginBottom: 4
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  duration: {
    marginLeft: 6,
    fontSize: 14,
    color: '#777'
  }
});
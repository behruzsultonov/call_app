import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Header from '../components/Header';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AddContactScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  const [contactPhone, setContactPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  
  // Load user data on component mount
  React.useEffect(() => {
    loadUserData();
  }, []);
  
  const loadUserData = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      if (userDataString) {
        const user = JSON.parse(userDataString);
        setUserId(user.id);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };
  
  const handleAddContact = async () => {
    if (!contactPhone.trim()) {
      Alert.alert(t('error'), t('pleaseEnterContactName'));
      return;
    }
    
    if (!userId) {
      Alert.alert(t('error'), t('userNotLoggedIn'));
      return;
    }
    
    setLoading(true);
    
    try {
      // Use the new API endpoint to add contact by phone number
      const response = await api.addContactByPhone(userId, contactPhone.trim());
      
      if (response.data.success) {
        Alert.alert(
          t('success'),
          t('contactAddedSuccessfully'),
          [{ text: t('ok'), onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert(t('error'), response.data.message || t('failedToAddContact'));
      }
    } catch (error) {
      console.error('Error adding contact:', error);
      Alert.alert(t('error'), t('failedToAddContact'));
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header 
        title={t('addContact')}
        onBack={() => navigation.goBack()}
      />
      
      <View style={styles.content}>
        <View style={[styles.inputContainer, { backgroundColor: theme.cardBackground }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder={t('enterPhoneNumber')}
            placeholderTextColor={theme.textSecondary}
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={handleAddContact}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.buttonText} />
          ) : (
            <Text style={[styles.addButtonText, { color: theme.buttonText }]}>
              {t('addContact')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20,
    elevation: 1,
  },
  input: {
    fontSize: 16,
    paddingVertical: 12,
  },
  addButton: {
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
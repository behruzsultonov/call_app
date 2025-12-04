import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Header from '../components/Header';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/Client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function OtpVerifyScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [code, setCode] = useState(['', '', '', '']);
  const inputs = useRef([]);
  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadPhoneNumber = async () => {
      try {
        const storedPhoneNumber = await AsyncStorage.getItem('tempPhoneNumber');
        if (storedPhoneNumber) {
          setPhoneNumber(storedPhoneNumber);
        }
      } catch (error) {
        console.error('Error loading phone number:', error);
      }
    };

    loadPhoneNumber();
  }, []);

  // Check if all digits are filled and auto-verify
  useEffect(() => {
    if (code.every(digit => digit !== '')) {
      handleVerify();
    }
  }, [code]);

  const handleChange = (value, index) => {
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 3) {
      inputs.current[index + 1].focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && index > 0 && !code[index]) {
      inputs.current[index - 1].focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = code.join('');
    
    if (otpCode.length !== 4) {
      Alert.alert(t('error'), t('pleaseEnterFullCode'));
      return;
    }
    
    setLoading(true);
    
    try {
      // Send OTP verification request to backend
      console.log('Sending OTP verification request with data:', {
        phone_number: phoneNumber,
        otp_code: otpCode
      });
      
      const response = await api.verifyOTP({
        phone_number: phoneNumber,
        otp_code: otpCode
      });
      
      console.log('Received OTP verification response:', response);
      console.log('Response data structure:', JSON.stringify(response.data, null, 2));
      
      if (response.data && response.data.success) {
        console.log('OTP verification successful');
        
        // Check the structure of the response
        if (response.data.data) {
          console.log('Response data.data:', response.data.data);
          
          // Check if user data exists in data.data.user
          if (response.data.data.user) {
            console.log('User data found in response.data.data.user:', response.data.data.user);
            
            // Save user data to AsyncStorage
            await AsyncStorage.setItem('userData', JSON.stringify(response.data.data.user));
            await AsyncStorage.setItem('authToken', response.data.data.token);
          } 
          // Sometimes the user data might be directly in data
          else if (response.data.data.id) {
            console.log('User data found directly in response.data.data:', response.data.data);
            
            // Save user data to AsyncStorage
            await AsyncStorage.setItem('userData', JSON.stringify(response.data.data));
            await AsyncStorage.setItem('authToken', response.data.token || '');
          }
          else {
            console.error('User data not found in expected locations');
            throw new Error('User data is missing in response');
          }
        } else {
          console.error('Response data.data is missing');
          throw new Error('Response data is malformed');
        }
        
        // Clear temp phone number
        await AsyncStorage.removeItem('tempPhoneNumber');
        
        // Navigate to main tabs
        navigation.navigate('MainTabs');
      } else {
        Alert.alert(t('error'), response.data?.message || t('invalidOTPCode'));
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        data: error.response?.data
      });
      Alert.alert(t('error'), t('failedToVerifyOTP'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleResendCode = () => {
    // Reset timer
    setTimer(60);
    // In a real app, you would send a request to resend the code
    Alert.alert(t('info'), t('codeResentSuccessfully'));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title={t('authorization')} />
      
      {/* Icon */}
      <View style={styles.iconContainer}>
        <Image
          source={{
            uri: 'https://cdn-icons-png.flaticon.com/512/15/15874.png',
          }}
          style={[styles.icon, { tintColor: theme.text }]}
        />
      </View>
      <Text style={[styles.subText, { color: theme.textSecondary }]}>{t('enterCode')}</Text>

      {/* OTP Input */}
      <View style={styles.otpRow}>
        {code.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputs.current[index] = ref)}
            value={digit}
            onChangeText={(val) => handleChange(val, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            style={[
              styles.otpBox,
              digit ? styles.otpBoxFilled : null,
              index === code.findIndex((x) => x === '') && styles.activeBorder,
              { 
                borderColor: theme.border, 
                color: theme.text,
                backgroundColor: theme.inputBackground
              }
            ]}
          />
        ))}
      </View>

      {/* Resend Button */}
      <TouchableOpacity 
        style={[styles.resendButton, { opacity: timer > 0 ? 0.5 : 1 }]}
        disabled={timer > 0}
        onPress={handleResendCode}
      >
        <Text style={[styles.resendButtonText, { color: timer > 0 ? theme.textSecondary : theme.primary }]}>
        {timer > 0
          ? `${timer} ${t('secondsToResendCode')}`
          : t('resendCode')}
      </Text>
      </TouchableOpacity>
      
      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  iconContainer: {
    alignItems: 'center',
    marginTop: 30,
  },

  icon: {
    width: 70,
    height: 70,
    tintColor: '#444',
  },

  deviceText: {
    marginTop: 30,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 30,
  },

  subText: {
    textAlign: 'center',
    marginTop: 15,
    fontSize: 14,
    color: '#666',
  },

  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 40,
    gap: 15,
  },

  otpBox: {
    width: 55,
    height: 55,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    textAlign: 'center',
    fontSize: 24,
    backgroundColor: '#f5f5f5'
  },

  activeBorder: {
    borderColor: '#D88A22',
    borderWidth: 2,
  },

  otpBoxFilled: {},

  timer: {
    marginTop: 25,
    textAlign: 'center',
    color: '#888',
  },

  button: {
    backgroundColor: '#D88A22',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 30,
    marginHorizontal: 20,
  },

  buttonText: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  
  resendButton: {
    marginTop: 25,
    textAlign: 'center',
    alignSelf: 'center',
  },
  
  resendButtonText: {
    textAlign: 'center',
    color: '#888',
  },
  
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
});
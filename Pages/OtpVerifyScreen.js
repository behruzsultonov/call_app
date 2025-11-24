import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
} from 'react-native';
import Header from '../components/Header';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

export default function OtpVerifyScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [code, setCode] = useState(['', '', '', '']);
  const inputs = useRef([]);
  const [timer, setTimer] = useState(60);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
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

  const handleVerify = () => {
    // Здесь должна быть логика проверки кода OTP
    // Для демо purposes мы просто считаем, что код правильный
    navigation.navigate('MainTabs');
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

      {/* Timer */}
      <Text style={[styles.timer, { color: theme.textSecondary }]}>
        {timer > 0
          ? `${timer} ${t('secondsToResendCode')}`
          : t('resendCode')}
      </Text>
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
});
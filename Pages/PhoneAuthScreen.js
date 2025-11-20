import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import CountryPicker from 'react-native-country-picker-modal';
import Header from '../components/Header';
import { useTranslation } from 'react-i18next';

export default function PhoneAuthScreen({ navigation }) {
  const { t } = useTranslation();
  const [countryCode, setCountryCode] = useState('TJ');
  const [callingCode, setCallingCode] = useState('992');
  const [countryName, setCountryName] = useState('Tajikistan'); // Added state for country name
  const [phone, setPhone] = useState('');

  const handleContinue = () => {
    // Здесь должна быть логика проверки номера телефона
    // Для демо purposes мы просто переходим на экран OTP
    navigation.navigate('OTP');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('authorization')} />
      
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>{t('enterPhoneNumber')}</Text>
        <Text style={styles.subtitle}>
          {t('enterPhoneNumber')}
        </Text>

        {/* Country Picker */}
        <View style={styles.countryRow}>
          <CountryPicker
            withFlag
            withFilter
            withCallingCode
            countryCode={countryCode}
            onSelect={(country) => {
              setCountryCode(country.cca2);
              setCallingCode(country.callingCode[0]);
              setCountryName(country.name); // Update country name when selected
            }}
            containerButtonStyle={styles.countryPicker}
          />
          <Text style={styles.countryName}>{countryName}</Text> {/* Use dynamic country name */}
        </View>

        {/* Phone Input */}
        <View style={styles.phoneRow}>
          <Text style={styles.prefix}>+{callingCode}</Text>
          <TextInput
            placeholder={t('phoneNumber')}
            keyboardType="phone-pad"
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
          />
        </View>
      </View>

      <View style={styles.bottomContainer}>
        {/* Continue button */}
        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>{t('continue')}</Text>
        </TouchableOpacity>

        <Text style={styles.terms}>
          {t('enterPhoneNumber')}{' '}
          <Text style={styles.link}>{t('phoneNumber')}</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  
  content: {
    flex: 1,
    paddingTop: 20,
  },

  bottomContainer: {
    paddingBottom: 20,
    // Add these properties to push the container to the bottom
    marginTop: 'auto',
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },

  subtitle: {
    textAlign: 'center',
    fontSize: 14,
    color: 'gray',
    marginTop: 8,
    marginBottom: 30,
    paddingHorizontal: 20,
  },

  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#ddd',
    paddingVertical: 10,
    marginBottom: 0,
    marginHorizontal: 20,
    minHeight: 50,
  },

  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 10,
    marginBottom: 0,
    marginHorizontal: 20,
    minHeight: 50,
  },

  countryPicker: {
    height: 40,
    justifyContent: 'center',
  },

  countryName: {
    marginLeft: 10,
    fontSize: 16,
  },

  prefix: {
    fontSize: 18,
    marginRight: 10,
    lineHeight: 40,
  },

  input: {
    flex: 1,
    fontSize: 18,
    height: 40,
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
    paddingTop: 2, // Slight adjustment to move text higher
  },

  button: {
    backgroundColor: '#D88A22',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 15,
    marginHorizontal: 20,
  },

  buttonText: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },

  terms: {
    fontSize: 12,
    textAlign: 'center',
    color: '#888',
    paddingHorizontal: 20,
  },

  link: {
    color: '#D88A22',
  },
});
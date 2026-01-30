import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, AppState } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import PinStorage from '../services/PinStorage';

const PinScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [pinValue, setPinValue] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);

  // Get mode from route params: 'enter' (validate existing), 'set' (set new), 'change' (change existing)
  const mode = route?.params?.mode || 'enter';
  const onComplete = route?.params?.onComplete;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground
        PinStorage.clearBackgroundTime();
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background
        PinStorage.recordBackgroundTime();
      }
      appState.current = nextAppState;
      setAppStateVisible(appState.current);
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  const handleDigitPress = (digit) => {
    if (pinValue.length < 4) {
      setError('');
      const newPinValue = pinValue + digit;
      setPinValue(newPinValue);
      
      // If we've reached 4 digits and we're in set/change mode, trigger confirmation
      if (newPinValue.length === 4 && (mode === 'set' || mode === 'change')) {
        // Directly call setPin with the newPinValue instead of relying on state
        validateAndSetPin(newPinValue);
      }
    }
  };

  const handleBackspace = () => {
    if (pinValue.length > 0) {
      setPinValue(prev => prev.slice(0, -1));
      setError('');
      // Reset the alert shown flag when user modifies PIN
      if (pinSetAlertShown) {
        setPinSetAlertShown(false);
      }
    }
  };

  const validatePin = useCallback(async () => {
    if (pinValue.length !== 4) {
      setError(t('pinMustBe4Digits'));
      return;
    }

    setIsLoading(true);
    try {
      const isValid = await PinStorage.validatePin(pinValue);
      if (isValid) {
        await PinStorage.recordUnlockTime();
        if (onComplete) {
          onComplete();
        }
        navigation.goBack();
      } else {
        setError(t('incorrectPin'));
        setPinValue('');
      }
    } catch (error) {
      console.error('PIN validation error:', error);
      setError(t('pinValidationError'));
      setPinValue('');
    } finally {
      setIsLoading(false);
    }
  }, [pinValue, onComplete, navigation, t]);

  const [pinSetAlertShown, setPinSetAlertShown] = useState(false);

  const validateAndSetPin = useCallback(async (pinToValidate) => {
    if (pinToValidate.length !== 4) {
      setError(t('pinMustBe4Digits'));
      return;
    }

    setIsLoading(true);
    try {
      const success = await PinStorage.setPin(pinToValidate);
      if (success && !pinSetAlertShown) {
        await PinStorage.recordUnlockTime();
        setPinSetAlertShown(true);
        Alert.alert(t('success'), t('pinSetSuccessfully'), [
          { text: 'OK', onPress: () => {
            setPinSetAlertShown(false); // Reset for next time
            // Navigate back and trigger completion callback
            if (onComplete) {
              onComplete();
            }
            navigation.goBack();
          }}
        ]);
      } else if (!success) {
        setError(t('failedToSetPin'));
      }
    } catch (error) {
      console.error('Error setting PIN:', error);
      setError(t('failedToSetPin'));
    } finally {
      setIsLoading(false);
    }
  }, [navigation, t, pinSetAlertShown, onComplete]);

  const setPin = useCallback(async () => {
    if (pinValue.length !== 4) {
      setError(t('pinMustBe4Digits'));
      return;
    }

    setIsLoading(true);
    try {
      const success = await PinStorage.setPin(pinValue);
      if (success && !pinSetAlertShown) {
        await PinStorage.recordUnlockTime();
        setPinSetAlertShown(true);
        Alert.alert(t('success'), t('pinSetSuccessfully'), [
          { text: 'OK', onPress: () => {
            setPinSetAlertShown(false); // Reset for next time
            // Navigate back and trigger completion callback
            if (onComplete) {
              onComplete();
            }
            navigation.goBack();
          }}
        ]);
      } else if (!success) {
        setError(t('failedToSetPin'));
      }
    } catch (error) {
      console.error('Error setting PIN:', error);
      setError(t('failedToSetPin'));
    } finally {
      setIsLoading(false);
    }
  }, [pinValue, navigation, t, pinSetAlertShown, onComplete]);

  const handleConfirm = useCallback(async () => {
    if (mode === 'enter') {
      await validatePin();
    } else if (mode === 'set' || mode === 'change') {
      await setPin();
    }
  }, [mode, validatePin, setPin]);

  useEffect(() => {
    if (pinValue.length === 4 && !isLoading && mode === 'enter') {
      // Only auto-submit for validation, not for setting/changing PIN
      const timer = setTimeout(() => {
        handleConfirm();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pinValue, isLoading, handleConfirm, mode]);

  const getTitle = () => {
    switch (mode) {
      case 'set': return t('setPin');
      case 'change': return t('changePin');
      default: return t('enterPin');
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'set': return t('enterNewPin');
      case 'change': return t('enterNewPin');
      default: return t('enterPinToUnlock');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>{getTitle()}</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {getDescription()}
        </Text>

        {/* PIN Dots */}
        <View style={styles.pinContainer}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[
                styles.pinDot,
                { 
                  backgroundColor: pinValue.length > index ? theme.primary : theme.inputBackground,
                  borderColor: theme.border
                }
              ]}
            />
          ))}
        </View>

        {/* Error Message */}
        {error ? (
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        ) : null}

        {/* Keypad */}
        <View style={styles.keypad}>
          {/* First row: 1, 2, 3 */}
          {[1, 2, 3].map((digit) => (
            <TouchableOpacity
              key={digit}
              style={[styles.key, { backgroundColor: theme.cardBackground }]}
              onPress={() => handleDigitPress(digit.toString())}
              disabled={isLoading}
            >
              <Text style={[styles.keyText, { color: theme.text }]}>{digit}</Text>
            </TouchableOpacity>
          ))}
          
          {/* Second row: 4, 5, 6 */}
          {[4, 5, 6].map((digit) => (
            <TouchableOpacity
              key={digit}
              style={[styles.key, { backgroundColor: theme.cardBackground }]}
              onPress={() => handleDigitPress(digit.toString())}
              disabled={isLoading}
            >
              <Text style={[styles.keyText, { color: theme.text }]}>{digit}</Text>
            </TouchableOpacity>
          ))}
          
          {/* Third row: 7, 8, 9 */}
          {[7, 8, 9].map((digit) => (
            <TouchableOpacity
              key={digit}
              style={[styles.key, { backgroundColor: theme.cardBackground }]}
              onPress={() => handleDigitPress(digit.toString())}
              disabled={isLoading}
            >
              <Text style={[styles.keyText, { color: theme.text }]}>{digit}</Text>
            </TouchableOpacity>
          ))}
          
          {/* Fourth row: empty (under 7), 0 (under 8), backspace (under 9) */}
          <View style={styles.keyEmpty} />
          
          <TouchableOpacity
            style={[styles.key, { backgroundColor: theme.cardBackground }]}
            onPress={() => handleDigitPress('0')}
            disabled={isLoading}
          >
            <Text style={[styles.keyText, { color: theme.text }]}>0</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.key, { backgroundColor: theme.cardBackground }]}
            onPress={handleBackspace}
            disabled={isLoading || pinValue.length === 0}
          >
            <Icon name="backspace" size={24} color={pinValue.length > 0 ? theme.primary : theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    marginBottom: 40,
    textAlign: 'center',
  },
  pinContainer: {
    flexDirection: 'row',
    marginBottom: 40,
    gap: 15,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
    width: '100%',
    maxWidth: 300,
  },
  key: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  keyEmpty: {
    width: 70,
    height: 70,
    borderRadius: 35,
    opacity: 0,
    pointerEvents: 'none',
  },
  keyText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default PinScreen;
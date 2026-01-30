import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

const PIN_STORAGE_KEY = 'callapp_pin_hash';
const PIN_ENABLED_KEY = 'callapp_pin_enabled';
const LAST_UNLOCK_TIME_KEY = 'callapp_last_unlock_time';
const APP_BACKGROUND_TIME_KEY = 'callapp_background_time';

// Secret key for encryption (in production, consider using device-specific keys)
const SECRET_KEY = 'callapp_pin_secret_2026';

class PinStorage {
  // Hash the PIN using SHA-256
  static hashPin(pin) {
    return CryptoJS.SHA256(pin).toString();
  }

  // Encrypt data using AES
  static encrypt(data) {
    return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
  }

  // Decrypt data using AES
  static decrypt(encryptedData) {
    const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  // Store PIN hash securely
  static async setPin(pin) {
    try {
      const hashedPin = this.hashPin(pin);
      const encryptedPin = this.encrypt(hashedPin);
      await AsyncStorage.setItem(PIN_STORAGE_KEY, encryptedPin);
      await AsyncStorage.setItem(PIN_ENABLED_KEY, 'true');
      return true;
    } catch (error) {
      console.error('Error setting PIN:', error);
      return false;
    }
  }

  // Validate PIN
  static async validatePin(pin) {
    try {
      const encryptedPin = await AsyncStorage.getItem(PIN_STORAGE_KEY);
      if (!encryptedPin) {
        return false;
      }

      const storedHash = this.decrypt(encryptedPin);
      const inputHash = this.hashPin(pin);
      
      return storedHash === inputHash;
    } catch (error) {
      console.error('Error validating PIN:', error);
      return false;
    }
  }

  // Check if PIN is enabled
  static async isPinEnabled() {
    try {
      const enabled = await AsyncStorage.getItem(PIN_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking PIN status:', error);
      return false;
    }
  }

  // Enable PIN
  static async enablePin() {
    try {
      await AsyncStorage.setItem(PIN_ENABLED_KEY, 'true');
      return true;
    } catch (error) {
      console.error('Error enabling PIN:', error);
      return false;
    }
  }

  // Disable PIN
  static async disablePin() {
    try {
      await AsyncStorage.removeItem(PIN_STORAGE_KEY);
      await AsyncStorage.removeItem(PIN_ENABLED_KEY);
      await AsyncStorage.removeItem(LAST_UNLOCK_TIME_KEY);
      await AsyncStorage.removeItem(APP_BACKGROUND_TIME_KEY);
      return true;
    } catch (error) {
      console.error('Error disabling PIN:', error);
      return false;
    }
  }

  // Record unlock time
  static async recordUnlockTime() {
    try {
      const now = Date.now().toString();
      await AsyncStorage.setItem(LAST_UNLOCK_TIME_KEY, now);
    } catch (error) {
      console.error('Error recording unlock time:', error);
    }
  }

  // Check if PIN is required (5-minute timeout)
  static async isPinRequired() {
    try {
      const pinEnabled = await this.isPinEnabled();
      if (!pinEnabled) {
        return false;
      }

      const lastUnlockTimeStr = await AsyncStorage.getItem(LAST_UNLOCK_TIME_KEY);
      if (!lastUnlockTimeStr) {
        return true; // No unlock time recorded, require PIN
      }

      const lastUnlockTime = parseInt(lastUnlockTimeStr, 10);
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

      return (now - lastUnlockTime) > fiveMinutes;
    } catch (error) {
      console.error('Error checking if PIN is required:', error);
      return true; // Default to requiring PIN on error
    }
  }

  // Record when app goes to background
  static async recordBackgroundTime() {
    try {
      const now = Date.now().toString();
      await AsyncStorage.setItem(APP_BACKGROUND_TIME_KEY, now);
    } catch (error) {
      console.error('Error recording background time:', error);
    }
  }

  // Check if app was in background for more than 5 minutes
  static async wasInBackgroundTooLong() {
    try {
      const backgroundTimeStr = await AsyncStorage.getItem(APP_BACKGROUND_TIME_KEY);
      if (!backgroundTimeStr) {
        return false;
      }

      const backgroundTime = parseInt(backgroundTimeStr, 10);
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      return (now - backgroundTime) > fiveMinutes;
    } catch (error) {
      console.error('Error checking background time:', error);
      return false;
    }
  }

  // Clear background time
  static async clearBackgroundTime() {
    try {
      await AsyncStorage.removeItem(APP_BACKGROUND_TIME_KEY);
    } catch (error) {
      console.error('Error clearing background time:', error);
    }
  }
}

export default PinStorage;
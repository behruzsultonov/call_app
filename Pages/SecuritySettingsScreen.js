import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, Alert } from 'react-native';
import Header from '../components/Header';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import PinStorage from '../services/PinStorage';

const SecuritySettingsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [isPinEnabled, setIsPinEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPinStatus();
  }, []);

  const loadPinStatus = async () => {
    try {
      const enabled = await PinStorage.isPinEnabled();
      setIsPinEnabled(enabled);
    } catch (error) {
      console.error('Error loading PIN status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a focus listener to refresh PIN status when returning to this screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadPinStatus();
    });
    
    return unsubscribe;
  }, [navigation]);

  const handlePinToggle = async (value) => {
    if (value) {
      // Enable PIN - navigate to set PIN screen
      navigation.navigate('Pin', {
        mode: 'set',
        onComplete: async () => {
          // Reload PIN status after successful PIN setup
          await loadPinStatus();
        }
      });
    } else {
      // Disable PIN - confirm first
      Alert.alert(
        t('disablePin'),
        t('disablePinConfirmation'),
        [
          {
            text: t('cancel'),
            style: 'cancel'
          },
          {
            text: t('disable'),
            style: 'destructive',
            onPress: async () => {
              try {
                await PinStorage.disablePin();
                setIsPinEnabled(false);
              } catch (error) {
                console.error('Error disabling PIN:', error);
                Alert.alert(t('error'), t('failedToDisablePin'));
              }
            }
          }
        ]
      );
    }
  };

  const handleChangePin = () => {
    // Navigate to PIN screen to change PIN
    navigation.navigate('Pin', {
      mode: 'change',
      onComplete: async () => {
        // Reload PIN status after successful PIN change
        await loadPinStatus();
      }
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title={t('security')} />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>{t('loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title={t('security')} />
      
      <View style={[styles.block, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>{t('enablePin')}</Text>
            <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
              {t('enablePinDescription')}
            </Text>
          </View>
          <Switch
            value={isPinEnabled}
            onValueChange={handlePinToggle}
            trackColor={{ false: theme.inputBackground, true: theme.primary + '40' }}
            thumbColor={isPinEnabled ? theme.primary : theme.textSecondary}
          />
        </View>
        
        {isPinEnabled && (
          <TouchableOpacity 
            style={[styles.changePinButton, { backgroundColor: theme.inputBackground }]}
            onPress={handleChangePin}
          >
            <Text style={[styles.changePinText, { color: theme.primary }]}>{t('changePin')}</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={[styles.infoBlock, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <Text style={[styles.infoTitle, { color: theme.text }]}>{t('securityInfo')}</Text>
        <Text style={[styles.infoText, { color: theme.textSecondary }]}>
          {t('pinSecurityInfo')}
        </Text>
      </View>
    </View>
  );
};

import { TouchableOpacity } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  block: {
    backgroundColor: '#fff',
    marginTop: 12,
    marginHorizontal: 15,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    borderWidth: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 15,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
  },
  changePinButton: {
    paddingVertical: 16,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  changePinText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoBlock: {
    backgroundColor: '#fff',
    marginTop: 12,
    marginHorizontal: 15,
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default SecuritySettingsScreen;
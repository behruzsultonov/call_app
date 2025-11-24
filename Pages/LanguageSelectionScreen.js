import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Header from '../components/Header';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

export default function LanguageSelectionScreen({ navigation }) {
  const { language, changeLanguage } = useLanguage();
  const { t } = useTranslation();
  const { theme } = useTheme();

  const languages = [
    { code: 'en', name: t('english'), localName: 'English' },
    { code: 'ru', name: t('russian'), localName: 'Русский' },
    { code: 'tj', name: t('tajik'), localName: 'Тоҷикӣ' },
  ];

  const handleLanguageChange = (langCode) => {
    changeLanguage(langCode);
    // Don't automatically go back - let the user manually go back
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title={t('language')} onBack={() => navigation.goBack()} />
      
      <ScrollView style={styles.content}>
        {languages.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.languageItem,
              { 
                backgroundColor: theme.cardBackground,
                borderBottomColor: theme.border
              },
              language === lang.code && { backgroundColor: theme.primary + '20' } // 20 is 12% opacity
            ]}
            onPress={() => handleLanguageChange(lang.code)}
          >
            <View style={styles.languageInfo}>
              <Text style={[styles.languageName, { color: theme.text }]}>{lang.name}</Text>
              <Text style={[styles.languageLocalName, { color: theme.textSecondary }]}>{lang.localName}</Text>
            </View>
            {language === lang.code && (
              <View style={[styles.checkmark, { backgroundColor: theme.primary }]}>
                <Text style={[styles.checkmarkText, { color: theme.buttonText }]}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 18,
    fontWeight: '500',
    color: '#000',
  },
  languageLocalName: {
    fontSize: 14,
    color: '#666',
    marginTop: 3,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
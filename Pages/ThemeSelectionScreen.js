import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Header from '../components/Header';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function ThemeSelectionScreen({ navigation }) {
  const { theme, changeTheme, themes } = useTheme();
  const { t } = useTranslation();

  const themeOptions = [
    { key: 'light', name: t('lightTheme'), description: t('lightThemeDesc') },
    { key: 'dark', name: t('darkTheme'), description: t('darkThemeDesc') },
  ];

  const handleThemeChange = (themeKey) => {
    changeTheme(themeKey);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header 
        title={t('theme')} 
        onBack={() => navigation.goBack()} 
      />
      
      <ScrollView style={styles.content}>
        {themeOptions.map((themeOption) => {
          const isSelected = theme.name === themeOption.key;
          const previewTheme = themes[themeOption.key];
          
          return (
            <TouchableOpacity
              key={themeOption.key}
              style={[
                styles.themeItem,
                { 
                  backgroundColor: previewTheme.cardBackground,
                  borderColor: isSelected ? previewTheme.primary : previewTheme.border
                }
              ]}
              onPress={() => handleThemeChange(themeOption.key)}
            >
              <View style={styles.themeInfo}>
                <Text style={[styles.themeName, { color: previewTheme.text }]}>
                  {themeOption.name}
                </Text>
                <Text style={[styles.themeDescription, { color: previewTheme.textSecondary }]}>
                  {themeOption.description}
                </Text>
              </View>
              
              {isSelected && (
                <View style={[styles.checkmark, { backgroundColor: previewTheme.primary }]}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  themeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    marginBottom: 10,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  themeInfo: {
    flex: 1,
  },
  themeName: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 5,
  },
  themeDescription: {
    fontSize: 14,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
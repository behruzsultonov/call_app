import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define themes
export const themes = {
  light: {
    name: 'light',
    primary: '#D88A22',
    secondary: '#1976d2',
    background: '#fff',
    cardBackground: '#fff',
    text: '#333',
    textSecondary: '#666',
    border: '#eee',
    headerBackground: '#fff',
    statusBar: 'dark-content',
    tabBarBackground: '#fff',
    tabBarActive: '#D88A22',
    tabBarInactive: '#999',
    buttonBackground: '#D88A22',
    buttonText: '#fff',
    inputBackground: '#f5f5f5',
    placeholder: '#999',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#f44336',
    info: '#2196F3',
  },
  dark: {
    name: 'dark',
    primary: '#D88A22',
    secondary: '#64b5f6',
    background: '#121212',
    cardBackground: '#1e1e1e',
    text: '#fff',
    textSecondary: '#aaa',
    border: '#333',
    headerBackground: '#1e1e1e',
    statusBar: 'light-content',
    tabBarBackground: '#1e1e1e',
    tabBarActive: '#D88A22',
    tabBarInactive: '#777',
    buttonBackground: '#D88A22',
    buttonText: '#fff',
    inputBackground: '#2d2d2d',
    placeholder: '#777',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#f44336',
    info: '#2196F3',
  },
};

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(themes.light);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('appTheme');
        if (savedTheme && themes[savedTheme]) {
          setCurrentTheme(themes[savedTheme]);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };

    loadTheme();
  }, []);

  const changeTheme = async (themeName) => {
    if (themes[themeName]) {
      setCurrentTheme(themes[themeName]);
      try {
        await AsyncStorage.setItem('appTheme', themeName);
      } catch (error) {
        console.error('Error saving theme:', error);
      }
    }
  };

  const value = {
    theme: currentTheme,
    changeTheme,
    themes,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
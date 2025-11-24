/**
 * CallApp - Audio Calling Application
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './Navigation/AppNavigator';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './localization/i18n';

function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ThemeProvider>
          <AppNavigator />
        </ThemeProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

export default App;
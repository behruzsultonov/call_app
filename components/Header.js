import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';

const Header = ({ title, showSearch = false, onSearchPress, onBack }) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { 
      backgroundColor: theme.headerBackground,
      borderBottomColor: theme.border,
      shadowColor: theme.text
    }]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
      <Text style={[styles.title, { color: theme.primary }]}>{title}</Text>
      {showSearch ? (
        <TouchableOpacity onPress={onSearchPress}>
          <Icon name="search" size={24} color={theme.primary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    elevation: 2, // Тень для Android
    shadowColor: '#000', // Тень для iOS
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#D88A22',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: 4,
  },
  placeholder: {
    width: 24, // Same width as icons to keep title centered
  },
});

export default Header;
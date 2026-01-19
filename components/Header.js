import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, SafeAreaView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Header = ({ title, showSearch = false, onSearchPress, onBack, searchVisible = false, onSearchChange = null, searchValue = '', rightButton = null }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  if (searchVisible) {
    return (
      <View style={[styles.container, { 
        backgroundColor: theme.headerBackground,
        borderBottomColor: theme.border,
        shadowColor: theme.text,
        paddingTop: insets.top
      }]}>        
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        
        <TextInput
          style={[styles.searchInput, { color: theme.text, backgroundColor: theme.cardBackground }]}
          placeholder="Search..."
          placeholderTextColor={theme.placeholder}
          value={searchValue}
          onChangeText={onSearchChange}
          autoFocus={true}
        />
        
        <TouchableOpacity onPress={() => {
          if (onSearchPress) onSearchPress(false);
          if (onSearchChange) onSearchChange('');
        }}>
          <Icon name="close" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { 
      backgroundColor: theme.headerBackground,
      borderBottomColor: theme.border,
      shadowColor: theme.text,
      paddingTop: insets.top
    }]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
      <Text style={[styles.title, { color: theme.primary }]}>{title}</Text>
      {rightButton ? (
        rightButton
      ) : showSearch ? (
        <TouchableOpacity onPress={() => onSearchPress && onSearchPress(true)}>
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
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
    marginHorizontal: 16,
  },
});

export default Header;
import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import Header from "../components/Header";
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

export default function ProfileScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  const handleLanguagePress = () => {
    navigation.navigate('LanguageSelection');
  };

  const handleThemePress = () => {
    navigation.navigate('ThemeSelection');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title={t('profile')} />
      
      {/* User Card and Status - now in one block */}
      <View style={[styles.block, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <View style={[styles.userCard, { backgroundColor: theme.cardBackground }]}>
          <View style={[styles.avatar, { backgroundColor: theme.inputBackground }]}>
            <Icon name="person" size={70} color={theme.text} />
            <View style={[styles.onlineDot, { backgroundColor: theme.success }]} />
          </View>

          <View>
            <Text style={[styles.userName, { color: theme.text }]}>CallApp</Text>
            <Text style={[styles.userPhone, { color: theme.textSecondary }]}>+992 98 704 6624</Text>
          </View>
        </View>
        
        {/* Separator line */}
        <View style={[styles.separator, { borderBottomColor: theme.border }]} />
        
        {/* Status Button */}
        <TouchableOpacity style={[styles.statusButton, { backgroundColor: theme.inputBackground }]}>
          <Icon name="mood" size={22} color={theme.warning} />
          <Text style={[styles.statusText, { color: theme.warning }]}>{t('setCustomStatus')}</Text>
        </TouchableOpacity>
      </View>

       {/* Category Blocks */}
       <View style={[styles.block, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <MenuItem icon="sim-card" color={theme.primary} label={t('tariffPlans')} theme={theme} />
        <MenuItem icon="bookmark-border" color={theme.primary} label={t('savedMessages')} theme={theme} />
      </View>

      <View style={[styles.block, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <MenuItem icon="notifications-none" color={theme.primary} label={t('notifications')} theme={theme} />
        <MenuItem icon="lock-outline" color={theme.primary} label={t('privacyAndSecurity')} theme={theme} />
        <MenuItem icon="call" color={theme.primary} label={t('callSettings')} theme={theme} />
        <MenuItem icon="storage" color={theme.primary} label={t('dataAndStorage')} theme={theme} />
        <MenuItem icon="palette" color={theme.primary} label={t('appearance')} theme={theme} onPress={handleThemePress} />
        <MenuItem icon="language" color={theme.primary} label={t('language')} theme={theme} onPress={handleLanguagePress} />
      </View>

      {/* New Block: Invite Friends, Rate App, Privacy Policy */}
      <View style={[styles.block, styles.lastBlock, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <MenuItem icon="person-add" color={theme.primary} label={t('inviteFriends')} theme={theme} />
        <MenuItem icon="star-border" color={theme.primary} label={t('rateApp')} theme={theme} />
        <MenuItem icon="description" color={theme.primary} label={t('privacyPolicy')} theme={theme} />
      </View>
    </ScrollView>
  );
}

function MenuItem({ icon, label, color, onPress, theme }) {
  return (
    <TouchableOpacity 
      style={[styles.menuItem, { borderBottomColor: theme.border }]} 
      onPress={onPress}
    >
      <Icon name={icon} size={24} color={color} />
      <Text style={[styles.menuText, { color: theme.text }]}>{label}</Text>
      <Icon name="chevron-right" size={20} color={theme.textSecondary} style={{ marginLeft: "auto" }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafafa",
  },

  userCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#fff",
    marginTop: 10,
  },
  avatar: {
    marginRight: 12,
    width: 70,
    height: 70,
    borderRadius: 35, // Make it circular
    backgroundColor: "#f5f5f5", // Add background color
    justifyContent: "center",
    alignItems: "center",
  },
  onlineDot: {
    width: 12,
    height: 12,
    backgroundColor: "#4caf50",
    borderRadius: 6,
    position: "absolute",
    bottom: 4,
    right: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
  },
  userPhone: {
    color: "#777",
    marginTop: 3,
  },

  statusButton: {
    backgroundColor: "#fff8e1",
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    paddingLeft: 15,
  },
  statusText: {
    marginLeft: 10,
    fontSize: 15,
    color: "#f4a100",
  },

  block: {
    backgroundColor: "#fff",
    marginTop: 12,
    marginHorizontal: 15,
    borderRadius: 10,
    overflow: "hidden",
    // Add shadow for Android
    elevation: 3,
    // Add shadow for iOS
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },

  lastBlock: {
    marginBottom: 20, // Add bottom margin to the last block
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  menuText: {
    fontSize: 16,
    marginLeft: 12,
  },
});
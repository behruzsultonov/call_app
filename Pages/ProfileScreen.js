import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import Header from "../components/Header";
import { useTranslation } from 'react-i18next';

export default function ProfileScreen({ navigation }) {
  const { t } = useTranslation();
  
  const handleLanguagePress = () => {
    navigation.navigate('LanguageSelection');
  };

  return (
    <ScrollView style={styles.container}>
      <Header title={t('profile')} />

      {/* User Card and Status - now in one block */}
      <View style={styles.block}>
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Icon name="person" size={70} color="#9e9e9e" />
            <View style={styles.onlineDot} />
          </View>

          <View>
            <Text style={styles.userName}>CallApp</Text>
            <Text style={styles.userPhone}>+992 98 704 6624</Text>
          </View>
        </View>
        
        {/* Separator line */}
        <View style={styles.separator} />
        
        {/* Status Button */}
        <TouchableOpacity style={styles.statusButton}>
          <Icon name="mood" size={22} color="#f4a100" />
          <Text style={styles.statusText}>{t('setCustomStatus')}</Text>
        </TouchableOpacity>
      </View>

       {/* Category Blocks */}
       <View style={styles.block}>
        <MenuItem icon="sim-card" color="#f4a100" label={t('tariffPlans')} />
        <MenuItem icon="bookmark-border" color="#1976d2" label={t('savedMessages')} />
      </View>

      <View style={styles.block}>
        <MenuItem icon="notifications-none" color="#1e88e5" label={t('notifications')} />
        <MenuItem icon="lock-outline" color="#6d4c41" label={t('privacyAndSecurity')} />
        <MenuItem icon="call" color="#8e24aa" label={t('callSettings')} />
        <MenuItem icon="storage" color="#43a047" label={t('dataAndStorage')} />
        <MenuItem icon="palette" color="#e53935" label={t('appearance')} />
        <MenuItem icon="language" color="#8e24aa" label={t('language')} onPress={handleLanguagePress} />
      </View>

      {/* New Block: Invite Friends, Rate App, Privacy Policy */}
      <View style={[styles.block, styles.lastBlock]}>
        <MenuItem icon="person-add" color="#1976d2" label={t('inviteFriends')} />
        <MenuItem icon="star-border" color="#f4a100" label={t('rateApp')} />
        <MenuItem icon="description" color="#43a047" label={t('privacyPolicy')} />
      </View>
    </ScrollView>
  );
}

function MenuItem({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Icon name={icon} size={24} color={color} />
      <Text style={styles.menuText}>{label}</Text>
      <Icon name="chevron-right" size={20} color="#bdbdbd" style={{ marginLeft: "auto" }} />
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
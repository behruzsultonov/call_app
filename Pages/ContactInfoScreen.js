import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';

export default function ContactInfoScreen({ navigation }) {
  const route = useRoute();
  const { theme } = useTheme();
  const { contact } = route.params || {};
  
  // Default contact data if none provided (for direct navigation)
  const displayContact = contact || {
    name: 'Jane Smith',
    phone: '+992 98 558 0777',
    status: 'green'
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, elevation: theme.elevation }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color={theme.primary} />
        </TouchableOpacity>

        <TouchableOpacity>
          <Icon name="add" size={26} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Avatar + Info + Actions */}
      <View style={[styles.mainBlock, { backgroundColor: theme.cardBackground, elevation: theme.elevation }]}>
        {/* Center part */}
        <View style={styles.center}>
          <View style={[styles.avatar, { backgroundColor: theme.success }]}>
            <Icon name="person" size={60} color={theme.buttonText} />
            <View style={[styles.statusCircle, { 
              backgroundColor: displayContact.status === 'green' ? theme.success : 
                             displayContact.status === 'yellow' ? '#FFD700' : theme.textSecondary,
              borderColor: theme.cardBackground
            }]} />
          </View>

          <Text style={[styles.phone, { color: theme.text }]}>{displayContact.phone}</Text>
          <Text style={[styles.timeAgo, { color: theme.textSecondary }]}>1 min. ago</Text>
        </View>

        {/* Actions */}
        <View style={[styles.actionsRow, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: theme.cardBackground }]}>
              <Icon name="chat-bubble" size={28} color={theme.primary} />
            </View>
            <Text style={[styles.actionLabel, { color: theme.primary }]}>chat</Text>
          </View>

          <View style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: theme.cardBackground }]}>
              <Icon name="call" size={28} color={theme.primary} />
            </View>
            <Text style={[styles.actionLabel, { color: theme.primary }]}>call</Text>
          </View>

          <View style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: theme.cardBackground }]}>
              <Icon name="videocam" size={28} color={theme.primary} />
            </View>
            <Text style={[styles.actionLabel, { color: theme.primary }]}>video</Text>
          </View>
        </View>
      </View>

      {/* Other blocks */}
      <View style={[styles.block, { backgroundColor: theme.cardBackground, elevation: theme.elevation }]}>
        <Text style={[styles.blockTitle, { color: theme.text }]}>main</Text>
        <Text style={[styles.blockPhone, { color: theme.primary }]}>{displayContact.phone}</Text>
      </View>

      <View style={[styles.block, { backgroundColor: theme.cardBackground, elevation: theme.elevation }]}>
        <Text style={[styles.blockLink, { color: theme.primary }]}>Shared Media</Text>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Text style={[styles.blockLink, { color: theme.primary, marginTop: 10 }]}>Notifications</Text>
      </View>

      {/* Block User */}
      <View style={[styles.block, { backgroundColor: theme.cardBackground, elevation: theme.elevation, marginTop: 10 }]}>
        <Text style={[styles.blockUser, { color: theme.error }]}>Block user</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3eef5",
  },

  header: {
    height: 60,
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 3,
  },

  center: {
    alignItems: "center",
    marginTop: 20,
  },

  avatar: {
    width: 110,
    height: 110,
    backgroundColor: "#9ccc65",
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  statusCircle: {
    width: 25,
    height: 25,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: "#fff",
    position: "absolute",
    bottom: 4,
    right: 8,
  },

  phone: {
    fontSize: 19,
    fontWeight: "600",
    marginTop: 12,
    color: "#000",
  },

  timeAgo: {
    fontSize: 14,
    color: "#7b7b7b",
    marginTop: 3,
  },

  mainBlock: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    borderRadius: 10,
    marginTop: 10,
    elevation: 3,
    paddingBottom: 20,
  },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 22,
    backgroundColor: "#fff",
    paddingVertical: 15,
  },

  actionItem: {
    alignItems: "center",
  },

  actionIcon: {
    backgroundColor: "#fdf1e4",
    padding: 12,
    borderRadius: 30,
  },

  actionLabel: {
    marginTop: 4,
    color: "#e88a17",
    fontSize: 13,
  },

  block: {
    backgroundColor: "#fff",
    padding: 15,
    marginTop: 10,
    marginHorizontal: 12,
    borderRadius: 10,
    elevation: 3,
  },

  blockTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },

  blockPhone: {
    marginTop: 5,
    fontSize: 16,
    color: "#e88a17",
  },

  blockLink: {
    fontSize: 16,
    color: "#e88a17",
  },

  blockUser: {
    fontSize: 16,
    color: "red",
    fontWeight: "600",
  },

  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 10,
  },
});
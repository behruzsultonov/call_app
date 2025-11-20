import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import Header from "../components/Header";
import { useTranslation } from 'react-i18next';

export default function ContactsScreen() {
  const { t } = useTranslation();
  
  return (
    <View style={styles.container}>
      <Header title={t('contacts')} showSearch={true} />

      {/* EMPTY ILLUSTRATION */}
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {t('emptyContactList')}
        </Text>
      </View>

      {/* FLOATING ADD BUTTON */}
      <TouchableOpacity style={styles.fab}>
        <Icon name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  /* EMPTY STATE */
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyImage: {
    width: 150,
    height: 150,
    opacity: 0.9,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    color: "#777",
    marginTop: 10,
  },

  /* FLOATING BUTTON */
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 55,
    height: 55,
    borderRadius: 35,
    backgroundColor: "#e28a1c",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },

  /* BOTTOM NAVIGATION */
  bottomNav: {
    height: 60,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    backgroundColor: "#ff5722",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "600",
  },
});
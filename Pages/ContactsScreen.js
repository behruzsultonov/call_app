import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import Header from "../components/Header";
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation } from '@react-navigation/native';

const contacts = [
  { id: '1', name: 'Jane Smith', phone: '+992 98 123 4567', status: 'gray' },
  { id: '2', name: 'Alex Johnson', phone: '+992 98 765 4321', status: 'green' },
  { id: '3', name: 'Maria Garcia', phone: '+992 98 111 2222', status: 'yellow' },
  { id: '4', name: 'David Wilson', phone: '+992 98 333 4444', status: 'gray' },
  { id: '5', name: 'Sarah Brown', phone: '+992 98 555 6666', status: 'green' },
  { id: '6', name: 'Michael Davis', phone: '+992 98 777 8888', status: 'yellow' }
];

export default function ContactsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const navigation = useNavigation();
  
  const handleContactPress = (contact) => {
    navigation.navigate('ContactInfo', { contact });
  };
  
  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: theme.cardBackground }]}
      onPress={() => handleContactPress(item)}
    >
      <View style={styles.leftSection}>
        <View style={[styles.avatar, { backgroundColor: '#D68B1F' }]}>
          <Text style={[styles.avatarText, { color: '#fff' }]}>{item.name[0]}</Text>
        </View>
        <View>
          <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
          <Text style={[styles.phone, { color: theme.textSecondary }]}>{item.phone}</Text>
        </View>
      </View>

      <View style={[styles.statusDot, { backgroundColor: item.status }]} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title={t('contacts')} showSearch={true} />

      <FlatList
        data={contacts}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 12 }}
      />

      {/* FLOATING ADD BUTTON */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: theme.primary }]}>
        <Icon name="add" size={30} color={theme.buttonText} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    justifyContent: 'space-between',
    elevation: 2
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#D68B1F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600'
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000'
  },
  phone: {
    fontSize: 14,
    color: '#777'
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7
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
});
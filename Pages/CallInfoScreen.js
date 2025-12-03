import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';

export default function CallInfoScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { phoneNumber } = route.params || {};
  
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.primary }]}>Звонок</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Contact Info */}
      <View style={[styles.contactContainer, { borderBottomColor: theme.border }]}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Text style={styles.avatarText}>
            {phoneNumber ? phoneNumber.slice(-1) : '1'}
          </Text>
        </View>
        <Text style={[styles.phoneNumber, { color: theme.text }]}>
          {phoneNumber || '992987654321'}
        </Text>
        <TouchableOpacity style={[styles.callBtn, { backgroundColor: theme.primary }]}>
          <Icon name="call" size={24} color={theme.buttonText} />
        </TouchableOpacity>
      </View>

      {/* History */}
      <ScrollView style={{ marginTop: 10 }}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Сегодня</Text>

        {/* 1 */}
        <View style={[styles.item, { borderBottomColor: theme.border }]}>
          <Icon name="north-east" size={20} color={theme.primary} />
          <View style={styles.itemInfo}>
            <Text style={[styles.time, { color: theme.text }]}>Сегодня 20:37</Text>
            <View style={styles.row}>
              <Icon name="call" size={16} color={theme.textSecondary} />
              <Text style={[styles.duration, { color: theme.textSecondary }]}>00:21 Мин</Text>
            </View>
          </View>
        </View>

        {/* 2 */}
        <View style={[styles.item, { borderBottomColor: theme.border }]}>
          <Icon name="videocam" size={20} color="#E04A4A" />
          <View style={styles.itemInfo}>
            <Text style={[styles.time, { color: theme.text }]}>Сегодня 20:36</Text>
            <View style={styles.row}>
              <Icon name="videocam" size={14} color={theme.textSecondary} />
              <Text style={[styles.duration, { color: theme.textSecondary }]}>00:00 Мин</Text>
            </View>
          </View>
        </View>

        {/* 3 */}
        <View style={[styles.item, { borderBottomColor: theme.border }]}>
          <Icon name="call-missed" size={20} color="#E04A4A" />
          <View style={styles.itemInfo}>
            <Text style={[styles.time, { color: theme.text }]}>Сегодня 20:36</Text>
            <View style={styles.row}>
              <Icon name="call" size={14} color={theme.textSecondary} />
              <Text style={[styles.duration, { color: theme.textSecondary }]}>00:00 Мин</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  headerTitle: {
    fontSize: 20,
    color: '#D68B1F',
    fontWeight: '600'
  },
  contactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#D68B1F',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  },
  phoneNumber: {
    flex: 1,
    marginLeft: 15,
    fontSize: 18,
    fontWeight: '500',
    color: '#000'
  },
  callBtn: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: '#D68B1F',
    justifyContent: 'center',
    alignItems: 'center'
  },
  sectionTitle: {
    paddingHorizontal: 16,
    color: '#7B7B7B',
    marginBottom: 10
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  itemInfo: {
    marginLeft: 12
  },
  time: {
    fontSize: 16,
    color: '#000',
    marginBottom: 4
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  duration: {
    marginLeft: 6,
    fontSize: 14,
    color: '#777'
  }
});
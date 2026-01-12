import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function ChatHeader({ title, onBackPress, onCallPress, onVideoCallPress, onContactInfoPress, rightButton }) {
  return (
    <View style={styles.header}>
      
      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={onBackPress}>
        <Icon name="arrow-back" size={26} color="#e88a17" />
      </TouchableOpacity>

      {/* Avatar + Name + Status */}
      <TouchableOpacity style={styles.centerBlock} onPress={onContactInfoPress}>
        <View style={styles.avatar}>
          <Icon name="person" size={32} color="#fff" />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.phone} numberOfLines={1} ellipsizeMode="tail">
            {title || '+992 98 55...'}
          </Text>
          <Text style={styles.status}>Just now</Text>
        </View>
      </TouchableOpacity>

      {/* Right icons */}
      <View style={styles.rightIcons}>
        <TouchableOpacity style={styles.iconBtn} onPress={onVideoCallPress}>
          <Icon name="videocam" size={24} color="#e88a17" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} onPress={onCallPress}>
          <Icon name="call" size={24} color="#e88a17" />
        </TouchableOpacity>

        {rightButton || (
          <TouchableOpacity style={styles.iconBtn}>
            <Icon name="more-vert" size={24} color="#e88a17" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    elevation: 4,
  },

  backBtn: {
    padding: 4,
  },

  centerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },

  textContainer: {
    flex: 1,
    marginLeft: 8,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#9ccc65',
    justifyContent: 'center',
    alignItems: 'center',
  },

  phone: {
    fontSize: 17,
    fontWeight: '500',
    color: '#000',
  },

  status: {
    fontSize: 13,
    color: '#e88a17',
    marginTop: -2,
  },

  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconBtn: {
    paddingHorizontal: 8,
  },
});
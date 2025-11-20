import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import CallsScreen from '../Pages/CallsScreen';
import ContactsScreen from '../Pages/ContactsScreen';
import ChatsScreen from '../Pages/ChatsScreen';
import ProfileScreen from '../Pages/ProfileScreen';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';

const Tab = createBottomTabNavigator();

export default function BottomTabs() {
  const { t } = useTranslation();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#D88A22',
        tabBarInactiveTintColor: '#999',
        tabBarLabelStyle: { fontSize: 12 },
        tabBarStyle: { paddingBottom: 5, paddingTop: 5, height: 60 },
        tabBarIcon: ({ color, size }) => {
          let iconName;
          switch(route.name) {
            case 'Chats': iconName = 'chat'; break;
            case 'Calls': iconName = 'call'; break;
            case 'Contacts': iconName = 'contacts'; break;
            case 'Profile': iconName = 'person'; break;
            default: iconName = 'circle'; break;
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarLabel: ({ focused, color }) => {
          let label;
          switch(route.name) {
            case 'Chats': label = t('chats'); break;
            case 'Calls': label = t('calls'); break;
            case 'Contacts': label = t('contacts'); break;
            case 'Profile': label = t('profile'); break;
            default: label = route.name; break;
          }
          return <Text style={{ color }}>{label}</Text>;
        },
      })}
    >
      <Tab.Screen name="Chats" component={ChatsScreen} />
      <Tab.Screen name="Calls" component={CallsScreen} />
      <Tab.Screen name="Contacts" component={ContactsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
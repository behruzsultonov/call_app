import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ChatsScreen from '../Pages/ChatsScreen';
import CallsScreen from '../Pages/CallsScreen';
import ContactsScreen from '../Pages/ContactsScreen';
import ProfileScreen from '../Pages/ProfileScreen';
import ChannelsScreen from '../Pages/ChannelsScreen';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

const Tab = createBottomTabNavigator();

export default function BottomTabs() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Chats') {
            iconName = 'chat';
          } else if (route.name === 'Calls') {
            iconName = 'call';
          } else if (route.name === 'Contacts') {
            iconName = 'contacts';
          } else if (route.name === 'Channels') {
            iconName = 'rss-feed';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.tabBarActive,
        tabBarInactiveTintColor: theme.tabBarInactive,
        tabBarStyle: {
          backgroundColor: theme.tabBarBackground,
          borderTopColor: theme.border,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Chats" 
        component={ChatsScreen} 
        options={{
          tabBarLabel: t('chats'),
        }}
      />
      <Tab.Screen 
        name="Calls" 
        component={CallsScreen} 
        options={{
          tabBarLabel: t('calls'),
        }}
      />
      <Tab.Screen 
        name="Contacts" 
        component={ContactsScreen} 
        options={{
          tabBarLabel: t('contacts'),
        }}
      />
      <Tab.Screen 
        name="Channels" 
        component={ChannelsScreen} 
        options={{
          tabBarLabel: 'Channels',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{
          tabBarLabel: t('profile'),
        }}
      />
    </Tab.Navigator>
  );
}
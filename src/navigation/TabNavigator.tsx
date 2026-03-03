import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';

const Tab = createBottomTabNavigator();

const tabIcon = (route: string, focused: boolean): keyof typeof Ionicons.glyphMap => {
  const icons: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
    Home: ['musical-notes', 'musical-notes-outline'],
  };
  const pair = icons[route] || ['ellipse', 'ellipse-outline'];
  return focused ? pair[0] : pair[1];
};

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={tabIcon(route.name, focused)} size={size} color={color} />
        ),
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#66668a',
        tabBarStyle: {
          backgroundColor: '#161622',
          borderTopColor: '#24243a',
          borderTopWidth: 0.5,
          paddingTop: 4,
          height: 88,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
    </Tab.Navigator>
  );
}
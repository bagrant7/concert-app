import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import MapScreen from '../screens/MapScreen';
import SearchScreen from '../screens/SearchScreen';
import StatsScreen from '../screens/StatsScreen';
import AddScreen from '../screens/AddScreen';
import { colors } from '../utils/theme';

const Tab = createBottomTabNavigator();

const tabIcon = (route: string, focused: boolean): keyof typeof Ionicons.glyphMap => {
  const icons: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
    Home: ['musical-notes', 'musical-notes-outline'],
    Map: ['map', 'map-outline'],
    Add: ['add-circle', 'add-circle-outline'],
    Search: ['search', 'search-outline'],
    Stats: ['stats-chart', 'stats-chart-outline'],
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
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
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
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Add" component={AddScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Stats" component={StatsScreen} />
    </Tab.Navigator>
  );
}

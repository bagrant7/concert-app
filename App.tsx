import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import TabNavigator from './src/navigation/TabNavigator';

const DarkNavTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: '#4f46e5',
    background: '#0b0b0f',
    card: '#161622',
    text: '#ffffff',
    border: '#24243a',
    notification: '#4f46e5',
  },
};

export default function App() {
  return (
    <NavigationContainer theme={DarkNavTheme}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0b0f" />
      <TabNavigator />
    </NavigationContainer>
  );
}
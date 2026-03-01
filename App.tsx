import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import TabNavigator from './src/navigation/TabNavigator';
import { colors } from './src/utils/theme';

const DarkNavTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

export default function App() {
  return (
    <NavigationContainer theme={DarkNavTheme}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <TabNavigator />
    </NavigationContainer>
  );
}

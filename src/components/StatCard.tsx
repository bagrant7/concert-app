import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../utils/theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export default function StatCard({ icon, label, value, subtitle, color = colors.accent }: Props) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    alignItems: 'center',
    flex: 1,
    minWidth: 140,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  value: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '900',
    letterSpacing: -1,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  subtitle: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});

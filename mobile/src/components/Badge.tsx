import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface BadgeProps {
  label: string;
  variant?: 'credit' | 'debit' | 'neutral' | 'primary' | 'warning';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  size = 'md',
  style,
}) => {
  const { colors } = useTheme();

  let bg = colors.border;
  let text = colors.textSecondary;

  if (variant === 'credit') {
    bg = 'rgba(16, 185, 129, 0.15)';
    text = colors.credit;
  } else if (variant === 'debit') {
    bg = 'rgba(244, 63, 94, 0.15)';
    text = colors.debit;
  } else if (variant === 'primary') {
    bg = colors.primaryGlow;
    text = colors.primary;
  } else if (variant === 'warning') {
    bg = 'rgba(245, 158, 11, 0.15)';
    text = colors.warning;
  }

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          paddingHorizontal: isSmall ? 6 : 10,
          paddingVertical: isSmall ? 2 : 4,
          borderRadius: 8,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: text,
          fontSize: isSmall ? 10 : 12,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </View>
  );
};

import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'outline';
}

export const Card: React.FC<CardProps> = ({ children, style, onPress, variant = 'default' }) => {
  const { colors } = useTheme();

  const containerStyle: ViewStyle = {
    backgroundColor: variant === 'outline' ? 'transparent' : colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: variant === 'elevated' ? colors.primaryLight : colors.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: variant === 'elevated' ? 0.25 : 0.08,
    shadowRadius: 8,
    elevation: variant === 'elevated' ? 4 : 2,
  };

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={[containerStyle, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[containerStyle, style]}>{children}</View>;
};

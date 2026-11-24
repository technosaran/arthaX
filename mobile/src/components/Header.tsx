import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, RefreshCw, Eye, EyeOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useFinancial } from '../context/FinancialContext';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'ArthaX',
  subtitle,
  onRefresh,
  isRefreshing = false,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isPrivacyMasked, togglePrivacyMask } = useFinancial();

  const handleTogglePrivacy = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    togglePrivacyMask();
  };

  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: 20,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {/* Privacy Mask Toggle Button */}
        <TouchableOpacity
          onPress={handleTogglePrivacy}
          activeOpacity={0.7}
          style={{
            padding: 8,
            borderRadius: 20,
            backgroundColor: isPrivacyMasked ? colors.primaryGlow : colors.card,
            borderWidth: 1,
            borderColor: isPrivacyMasked ? colors.primary : colors.border,
          }}
        >
          {isPrivacyMasked ? (
            <EyeOff size={18} color={colors.primary} />
          ) : (
            <Eye size={18} color={colors.textSecondary} />
          )}
        </TouchableOpacity>

        {onRefresh && (
          <TouchableOpacity
            onPress={onRefresh}
            activeOpacity={0.7}
            style={{
              padding: 8,
              borderRadius: 20,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <RefreshCw
              size={18}
              color={isRefreshing ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
        )}

        <View
          style={{
            padding: 8,
            borderRadius: 20,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Bell size={18} color={colors.textSecondary} />
        </View>
      </View>
    </View>
  );
};

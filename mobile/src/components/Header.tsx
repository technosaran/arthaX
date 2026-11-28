import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
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
  const { isPrivacyMasked, togglePrivacyMask, insights } = useFinancial();

  const handleTogglePrivacy = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    togglePrivacyMask();
  };

  const handleNotifications = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (insights.length === 0) {
      Alert.alert('Notifications', 'You are all caught up. No new alerts.');
      return;
    }
    Alert.alert(
      `Financial Alerts (${insights.length})`,
      insights.map((item) => `• ${item.title}: ${item.description}`).join('\n\n')
    );
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
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* Privacy Mask Toggle Button (44x44pt Apple HIG target) */}
        <TouchableOpacity
          onPress={handleTogglePrivacy}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={isPrivacyMasked ? 'Show balances' : 'Hide balances'}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
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
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              onRefresh();
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Refresh financial data"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
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

        <TouchableOpacity
          onPress={handleNotifications}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="View financial alerts"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Bell size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

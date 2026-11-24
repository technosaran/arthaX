import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Wifi, Building2, CreditCard as CardIcon, ShieldCheck } from 'lucide-react-native';
import Svg, { Rect, Path } from 'react-native-svg';
import { Account } from '../types';
import { formatIndianCurrency } from './CurrencyText';

interface AppleWalletAccountCardProps {
  account: Account;
  isExpanded?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

// Gold/Silver Smart EMV Chip
const EmvChip = () => (
  <View
    style={{
      width: 40,
      height: 30,
      borderRadius: 6,
      backgroundColor: '#fcd34d',
      borderWidth: 1,
      borderColor: '#d97706',
      overflow: 'hidden',
      padding: 3,
      justifyContent: 'space-around',
    }}
  >
    <View style={{ height: 1, backgroundColor: '#b45309' }} />
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, borderWidth: 1, borderColor: '#b45309' }} />
      <View style={{ width: 10, height: 10, borderRadius: 2, borderWidth: 1, borderColor: '#b45309' }} />
    </View>
    <View style={{ height: 1, backgroundColor: '#b45309' }} />
  </View>
);

export function getCardTheme(name: string, institution: string, type: string) {
  const clean = `${name} ${institution} ${type}`.toLowerCase();

  if (clean.includes('hdfc')) {
    return {
      colors: ['#1e3a8a', '#0f172a'] as const,
      borderColor: '#3b82f6',
      ambientGlow: 'rgba(59, 130, 246, 0.3)',
      badge: 'HDFC BANK',
      network: 'VISA INFINITE',
    };
  }
  if (clean.includes('icici')) {
    return {
      colors: ['#c2410c', '#431407'] as const,
      borderColor: '#f97316',
      ambientGlow: 'rgba(249, 115, 22, 0.3)',
      badge: 'ICICI BANK',
      network: 'MASTERCARD',
    };
  }
  if (clean.includes('axis')) {
    return {
      colors: ['#831843', '#4c0519'] as const,
      borderColor: '#ec4899',
      ambientGlow: 'rgba(236, 72, 153, 0.3)',
      badge: 'AXIS BANK',
      network: 'MAGNUS WORLD',
    };
  }
  if (clean.includes('sbi') || clean.includes('state bank')) {
    return {
      colors: ['#0369a1', '#082f49'] as const,
      borderColor: '#38bdf8',
      ambientGlow: 'rgba(56, 189, 248, 0.3)',
      badge: 'STATE BANK OF INDIA',
      network: 'RUPAY PLATINUM',
    };
  }
  if (clean.includes('zerodha') || clean.includes('demat') || type === 'INVESTMENT') {
    return {
      colors: ['#0f766e', '#134e4a'] as const,
      borderColor: '#14b8a6',
      ambientGlow: 'rgba(20, 184, 166, 0.3)',
      badge: 'ZERODHA DEMAT',
      network: 'SEBI REGISTERED',
    };
  }
  if (type === 'CREDIT_CARD') {
    return {
      colors: ['#1e293b', '#090d16'] as const,
      borderColor: '#475569',
      ambientGlow: 'rgba(148, 163, 184, 0.2)',
      badge: 'TITANIUM BLACK',
      network: 'WORLD ELITE',
    };
  }

  // Default Emerald Liquid Wealth
  return {
    colors: ['#065f46', '#022c22'] as const,
    borderColor: '#10b981',
    ambientGlow: 'rgba(16, 185, 129, 0.25)',
    badge: 'ARTHAX WEALTH',
    network: 'SMART SAVINGS',
  };
}

export const AppleWalletAccountCard: React.FC<AppleWalletAccountCardProps> = ({
  account,
  isExpanded = false,
  onPress,
  style,
}) => {
  const theme = getCardTheme(account.name, account.institution, account.type);
  const isCredit = account.type === 'CREDIT_CARD';
  const balanceAmount = isCredit ? Math.abs(account.current_balance) : account.current_balance;

  const handlePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    if (onPress) onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handlePress}
      style={[
        {
          borderRadius: 22,
          shadowColor: theme.borderColor,
          shadowOffset: { width: 0, height: isExpanded ? 12 : 6 },
          shadowOpacity: isExpanded ? 0.45 : 0.25,
          shadowRadius: isExpanded ? 18 : 10,
          elevation: isExpanded ? 10 : 5,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={theme.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 22,
          padding: 22,
          borderWidth: 1.5,
          borderColor: theme.borderColor,
          minHeight: 200,
          justifyContent: 'space-between',
        }}
      >
        {/* Top Header Row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#ffffff', letterSpacing: 0.8 }}>
                {theme.badge}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' }}>
              {account.type.replace('_', ' ')}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Wifi size={18} color="rgba(255, 255, 255, 0.8)" style={{ transform: [{ rotate: '90deg' }] }} />
            <ShieldCheck size={18} color="#34d399" />
          </View>
        </View>

        {/* Chip & Mask Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 14 }}>
          <EmvChip />
          <Text
            style={{
              fontSize: 16,
              color: 'rgba(255, 255, 255, 0.85)',
              fontFamily: 'monospace',
              letterSpacing: 2,
              fontWeight: '700',
            }}
          >
            {account.account_number_mask || '•••• •••• •••• 8821'}
          </Text>
        </View>

        {/* Balance & Network Row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.65)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {isCredit ? 'Current Due' : 'Available Balance'}
            </Text>
            <Text
              style={{
                fontSize: 24,
                fontWeight: '900',
                color: isCredit ? '#fca5a5' : '#ffffff',
                marginTop: 2,
              }}
            >
              {formatIndianCurrency(balanceAmount)}
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '900',
                color: 'rgba(255, 255, 255, 0.9)',
                letterSpacing: 1.5,
                fontStyle: 'italic',
              }}
            >
              {theme.network}
            </Text>
            <Text style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.5)', marginTop: 2 }}>
              {account.name}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

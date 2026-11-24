import React from 'react';
import { Text, TextStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useFinancial } from '../context/FinancialContext';

interface CurrencyTextProps {
  amount: number;
  style?: TextStyle;
  currency?: string;
  compact?: boolean;
  colored?: boolean;
  showSign?: boolean;
}

export const formatIndianCurrency = (amount: number, compact = false, currency = '₹'): string => {
  const absAmount = Math.abs(amount);
  
  if (compact) {
    if (absAmount >= 10000000) {
      return `${currency}${(absAmount / 10000000).toFixed(2)} Cr`;
    }
    if (absAmount >= 100000) {
      return `${currency}${(absAmount / 100000).toFixed(2)} L`;
    }
    if (absAmount >= 1000) {
      return `${currency}${(absAmount / 1000).toFixed(1)} K`;
    }
    return `${currency}${absAmount.toLocaleString('en-IN')}`;
  }

  const parts = absAmount.toFixed(2).split('.');
  let lastThree = parts[0].substring(parts[0].length - 3);
  const otherNumbers = parts[0].substring(0, parts[0].length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  return `${currency} ${formatted}`;
};

export const CurrencyText: React.FC<CurrencyTextProps> = ({
  amount,
  style,
  currency = '₹',
  compact = false,
  colored = false,
  showSign = false,
}) => {
  const { colors } = useTheme();
  const { isPrivacyMasked } = useFinancial();

  if (isPrivacyMasked) {
    return (
      <Text style={[{ color: colors.text, fontWeight: '700', letterSpacing: 1 }, style]}>
        {currency} ••••••
      </Text>
    );
  }

  let sign = '';
  if (showSign) {
    sign = amount > 0 ? '+ ' : amount < 0 ? '- ' : '';
  }

  let color = colors.text;
  if (colored) {
    color = amount > 0 ? colors.credit : amount < 0 ? colors.debit : colors.text;
  }

  const formatted = formatIndianCurrency(amount, compact, currency);

  return (
    <Text style={[{ color, fontWeight: '700' }, style]}>
      {sign}{formatted}
    </Text>
  );
};

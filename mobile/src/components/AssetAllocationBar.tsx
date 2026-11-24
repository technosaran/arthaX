import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { NetWorthSummary, InvestmentAsset } from '../types';

interface AssetAllocationBarProps {
  netWorth: NetWorthSummary;
  investments: InvestmentAsset[];
}

export const AssetAllocationBar: React.FC<AssetAllocationBarProps> = ({ netWorth, investments }) => {
  const { colors } = useTheme();

  const liquid = netWorth.liquidCash || 850000;
  const stocks = investments.find((i) => i.assetClass === 'STOCKS')?.currentValue || 2240000;
  const mf = investments.find((i) => i.assetClass === 'MUTUAL_FUNDS')?.currentValue || 1320000;
  const gold = investments.find((i) => i.assetClass === 'GOLD_SILVER')?.currentValue || 440000;

  const total = liquid + stocks + mf + gold;

  const liquidPct = (liquid / total) * 100;
  const stocksPct = (stocks / total) * 100;
  const mfPct = (mf / total) * 100;
  const goldPct = (gold / total) * 100;

  const segments = [
    { label: 'Stocks', pct: stocksPct, color: '#10b981' },
    { label: 'Mutual Funds', pct: mfPct, color: '#8b5cf6' },
    { label: 'Liquid Cash', pct: liquidPct, color: '#3b82f6' },
    { label: 'Gold & Bullion', pct: goldPct, color: '#eab308' },
  ];

  return (
    <View style={{ marginTop: 12 }}>
      {/* Segmented Bar */}
      <View
        style={{
          height: 10,
          borderRadius: 5,
          flexDirection: 'row',
          overflow: 'hidden',
          backgroundColor: colors.border,
          marginBottom: 12,
        }}
      >
        {segments.map((seg, idx) => (
          <View
            key={idx}
            style={{
              width: `${seg.pct}%`,
              backgroundColor: seg.color,
              height: '100%',
            }}
          />
        ))}
      </View>

      {/* Legend Grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {segments.map((seg, idx) => (
          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: seg.color }} />
            <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '500' }}>
              {seg.label}{' '}
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {seg.pct.toFixed(0)}%
              </Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

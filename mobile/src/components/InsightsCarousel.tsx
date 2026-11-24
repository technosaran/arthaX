import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { AlertCircle, TrendingUp, Sparkles, ArrowRight, Zap, Scale } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { FinancialInsight } from '../types';

interface InsightsCarouselProps {
  insights: FinancialInsight[];
}

export const InsightsCarousel: React.FC<InsightsCarouselProps> = ({ insights }) => {
  const { colors, isDark } = useTheme();

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <Sparkles size={16} color={colors.primary} />
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
          Smart Financial Intelligence
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {insights.map((item) => {
          let iconBg = 'rgba(244, 63, 94, 0.15)';
          let iconColor = '#f43f5e';
          let borderColor = 'rgba(244, 63, 94, 0.25)';
          let Icon = Zap;

          if (item.type === 'GROWTH') {
            iconBg = colors.primaryGlow;
            iconColor = colors.primary;
            borderColor = 'rgba(16, 185, 129, 0.25)';
            Icon = TrendingUp;
          } else if (item.type === 'TAX') {
            iconBg = 'rgba(245, 158, 11, 0.15)';
            iconColor = '#f59e0b';
            borderColor = 'rgba(245, 158, 11, 0.25)';
            Icon = Scale;
          }

          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.85}
              onPress={() => Alert.alert(item.title, item.description)}
              style={{
                width: 260,
                backgroundColor: colors.card,
                borderRadius: 18,
                padding: 16,
                borderWidth: 1,
                borderColor,
                justifyContent: 'space-between',
              }}
            >
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={iconColor} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, flex: 1 }} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>

                <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }} numberOfLines={2}>
                  {item.description}
                </Text>
              </View>

              {item.actionLabel && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                    {item.actionLabel}
                  </Text>
                  <ArrowRight size={12} color={colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

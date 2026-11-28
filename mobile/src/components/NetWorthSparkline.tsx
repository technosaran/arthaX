import React, { useState } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { COMPACT_HIT_SLOP } from '../theme/platform';

interface NetWorthSparklineProps {
  currentValue: number;
}

const timelineData: Record<string, number[]> = {
  '1M': [4100000, 4150000, 4220000, 4310000, 4380000, 4530000],
  '3M': [3850000, 3950000, 4080000, 4210000, 4350000, 4530000],
  '6M': [3400000, 3600000, 3850000, 4100000, 4320000, 4530000],
  '1Y': [2900000, 3200000, 3550000, 3900000, 4250000, 4530000],
};

export const NetWorthSparkline: React.FC<NetWorthSparklineProps> = ({ currentValue }) => {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [selectedRange, setSelectedRange] = useState<'1M' | '3M' | '6M' | '1Y'>('3M');

  const data = timelineData[selectedRange];
  const min = Math.min(...data);
  const max = Math.max(...data);

  const width = Math.max(windowWidth - 72, 180); // Responsive padding offset for iPhone/iPad
  const height = 90;

  // Build SVG Path
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / (max - min || 1)) * (height - 20) - 10;
    return `${x},${y}`;
  });

  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  const lastPoint = points[points.length - 1].split(',');
  const lastX = parseFloat(lastPoint[0]);
  const lastY = parseFloat(lastPoint[1]);

  const handleRangeChange = (range: '1M' | '3M' | '6M' | '1Y') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedRange(range);
  };

  return (
    <View style={{ marginTop: 16 }}>
      {/* Sparkline Canvas */}
      <Svg width={width} height={height}>
        <Defs>
          <SvgLinearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <Stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </SvgLinearGradient>
        </Defs>

        {/* Gradient Fill under Curve */}
        <Path d={areaPath} fill="url(#emeraldGradient)" />

        {/* Line */}
        <Path d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />

        {/* Highlight Dot on Latest Point */}
        <Circle cx={lastX} cy={lastY} r="4.5" fill="#10b981" />
        <Circle cx={lastX} cy={lastY} r="8" fill="rgba(16, 185, 129, 0.3)" />
      </Svg>

      {/* Timeline Range Filter Chips */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        {(['1M', '3M', '6M', '1Y'] as const).map((range) => {
          const isSelected = selectedRange === range;
          return (
            <TouchableOpacity
              key={range}
              onPress={() => handleRangeChange(range)}
              hitSlop={COMPACT_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={`Show ${range} trajectory`}
              accessibilityState={{ selected: isSelected }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 10,
                backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: isSelected ? '#10b981' : colors.textSecondary,
                }}
              >
                {range}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

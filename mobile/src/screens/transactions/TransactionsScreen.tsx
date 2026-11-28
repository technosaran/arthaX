import React, { useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Search,
  Copy,
  Receipt,
  Utensils,
  Car,
  ShoppingBag,
  Film,
  Briefcase,
  TrendingUp,
  CircleDollarSign,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useFinancial } from '../../context/FinancialContext';
import { Header } from '../../components/Header';
import { CurrencyText } from '../../components/CurrencyText';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { CanonicalTransaction } from '../../types';
import { COMPACT_HIT_SLOP, getScrollBottomPadding, MONO_FONT } from '../../theme/platform';

// Helper to resolve dynamic merchant icons
export function getMerchantIcon(name: string, category?: string) {
  const clean = `${name} ${category || ''}`.toLowerCase();

  if (clean.includes('swiggy') || clean.includes('zomato') || clean.includes('food') || clean.includes('dining')) {
    return { icon: Utensils, bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316' };
  }
  if (clean.includes('uber') || clean.includes('ola') || clean.includes('travel') || clean.includes('transport')) {
    return { icon: Car, bg: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' };
  }
  if (clean.includes('apple') || clean.includes('amazon') || clean.includes('shopping') || clean.includes('electronics')) {
    return { icon: ShoppingBag, bg: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' };
  }
  if (clean.includes('netflix') || clean.includes('spotify') || clean.includes('entertainment')) {
    return { icon: Film, bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' };
  }
  if (clean.includes('salary') || clean.includes('google') || clean.includes('income')) {
    return { icon: Briefcase, bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
  }
  if (clean.includes('sip') || clean.includes('mutual') || clean.includes('stock') || clean.includes('invest')) {
    return { icon: TrendingUp, bg: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' };
  }

  return { icon: CircleDollarSign, bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' };
}

export const TransactionsScreen = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { transactions, isRefreshing, refreshData } = useFinancial();

  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'DEBIT' | 'CREDIT'>('ALL');
  const [selectedTx, setSelectedTx] = useState<CanonicalTransaction | null>(null);

  const filteredTransactions = transactions.filter((tx) => {
    const matchesDirection = directionFilter === 'ALL' || tx.direction === directionFilter;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      tx.clean_merchant?.toLowerCase().includes(query) ||
      tx.normalized_narration.toLowerCase().includes(query) ||
      tx.category?.toLowerCase().includes(query) ||
      tx.upi_vpa?.toLowerCase().includes(query);
    return matchesDirection && matchesSearch;
  });

  // Group transactions by date sections
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const sectionsMap: Record<string, CanonicalTransaction[]> = {};
  filteredTransactions.forEach((tx) => {
    let title = 'Earlier in November';
    if (tx.transaction_date === todayStr) {
      title = 'Today';
    } else if (tx.transaction_date === yesterdayStr) {
      title = 'Yesterday';
    }
    if (!sectionsMap[title]) sectionsMap[title] = [];
    sectionsMap[title].push(tx);
  });

  const sections = Object.keys(sectionsMap).map((title) => ({
    title,
    data: sectionsMap[title],
  }));

  const handleCopyReference = async (ref?: string) => {
    if (!ref) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    try {
      await Share.share({ message: ref, title: 'Transaction Reference' });
    } catch {
      Alert.alert('Reference UTR', ref);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="Ledger"
        subtitle={`${filteredTransactions.length} verified transactions`}
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />

      {/* Search and Filters */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            borderRadius: 14,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: colors.border,
            height: 44,
          }}
        >
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            placeholder="Search merchant, UPI ID, category..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            style={{ flex: 1, marginLeft: 8, color: colors.text, fontSize: 14 }}
          />
        </View>

        {/* Filter Chips */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {(['ALL', 'DEBIT', 'CREDIT'] as const).map((filter) => {
            const isSelected = directionFilter === filter;
            const label = filter === 'ALL' ? 'All' : filter === 'DEBIT' ? 'Debits (Out)' : 'Credits (In)';
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setDirectionFilter(filter)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 10,
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: isSelected ? '#ffffff' : colors.textSecondary,
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Grouped Section List */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: getScrollBottomPadding(insets.bottom) }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshData} tintColor={colors.primary} />}
        renderSectionHeader={({ section: { title } }) => (
          <View style={{ paddingVertical: 10, backgroundColor: colors.background }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              {title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const { icon: Icon, bg, color } = getMerchantIcon(item.clean_merchant || item.normalized_narration, item.category);
          return (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setSelectedTx(item)}
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 14,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Icon size={20} color={color} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                    {item.clean_merchant || item.normalized_narration}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      {item.account_name}
                    </Text>
                    {item.category && (
                      <Badge label={item.category} size="sm" variant={item.direction === 'CREDIT' ? 'credit' : 'neutral'} />
                    )}
                  </View>
                </View>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <CurrencyText
                  amount={item.amount}
                  colored
                  showSign
                  style={{ fontSize: 16, fontWeight: '800' }}
                />
                {item.upi_vpa && (
                  <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                    UPI
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Digital Receipt / Transaction Detail Modal */}
      <BottomSheetModal visible={!!selectedTx} onClose={() => setSelectedTx(null)}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Receipt size={20} color={colors.primary} />
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                  Transaction Intelligence
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedTx(null)}
                hitSlop={COMPACT_HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel="Close transaction details"
                style={{ padding: 4 }}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedTx && (
              <>
                {/* Big Amount Header */}
                <View style={{ alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' }}>
                    {selectedTx.direction === 'CREDIT' ? 'Total Income Received' : 'Total Outflow'}
                  </Text>
                  <CurrencyText
                    amount={selectedTx.amount}
                    colored
                    showSign
                    style={{ fontSize: 32, fontWeight: '900', marginTop: 4 }}
                  />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 4 }}>
                    {selectedTx.clean_merchant}
                  </Text>
                </View>

                {/* Metadata Breakdown */}
                <View style={{ marginVertical: 16, gap: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>Account</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{selectedTx.account_name}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>Execution Date</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{selectedTx.transaction_date}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>Reference UTR</Text>
                    <TouchableOpacity
                      onPress={() => handleCopyReference(selectedTx.transaction_reference || 'REF-882194')}
                      hitSlop={COMPACT_HIT_SLOP}
                      accessibilityRole="button"
                      accessibilityLabel="Share or copy transaction reference"
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: MONO_FONT, color: colors.primary, fontWeight: '700' }}>
                        {selectedTx.transaction_reference || 'REF-882194'}
                      </Text>
                      <Copy size={12} color={colors.primary} />
                    </TouchableOpacity>
                  </View>

                  {selectedTx.upi_vpa && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>UPI VPA</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#38bdf8' }}>{selectedTx.upi_vpa}</Text>
                    </View>
                  )}

                  {/* Verbatim Bank Narration Box */}
                  <View style={{ marginTop: 8, backgroundColor: colors.background, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>
                      Original Bank Narration
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: MONO_FONT, color: colors.textSecondary, lineHeight: 16 }}>
                      {selectedTx.original_narration}
                    </Text>
                  </View>
                </View>

                <Button title="Done" variant="secondary" onPress={() => setSelectedTx(null)} />
              </>
            )}
      </BottomSheetModal>
    </View>
  );
};

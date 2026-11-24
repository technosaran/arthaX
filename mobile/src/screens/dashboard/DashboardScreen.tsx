import React from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  TrendingUp,
  CreditCard,
  PiggyBank,
  PieChart,
  ShieldCheck,
  Compass,
  ArrowRight,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useFinancial } from '../../context/FinancialContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { CurrencyText } from '../../components/CurrencyText';
import { Badge } from '../../components/Badge';
import { NetWorthSparkline } from '../../components/NetWorthSparkline';
import { AssetAllocationBar } from '../../components/AssetAllocationBar';
import { InsightsCarousel } from '../../components/InsightsCarousel';

export const DashboardScreen = ({ navigation }: any) => {
  const { colors, isDark } = useTheme();
  const { netWorth, cashFlow, accounts, transactions, investments, insights, isRefreshing, refreshData } = useFinancial();

  const recentTransactions = transactions.slice(0, 5);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="ArthaX"
        subtitle="Universal Wealth & Intelligence"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshData}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Net Worth Card with Sparkline */}
        <LinearGradient
          colors={isDark ? ['#1e293b', '#0f172a'] : ['#065f46', '#022c22']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 26,
            padding: 22,
            marginBottom: 20,
            borderWidth: 1.5,
            borderColor: isDark ? '#334155' : '#059669',
            shadowColor: '#10b981',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={16} color="#34d399" />
              <Text style={{ fontSize: 12, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Net Worth Trajectory
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
              <TrendingUp size={12} color="#10b981" />
              <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>
                +14.2% YoY
              </Text>
            </View>
          </View>

          <CurrencyText
            amount={netWorth.netWorth}
            style={{ fontSize: 36, fontWeight: '900', color: '#ffffff', marginTop: 10 }}
          />

          {/* Interactive Trajectory Curve */}
          <NetWorthSparkline currentValue={netWorth.netWorth} />

          {/* Assets & Liabilities Split */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingTop: 16,
              marginTop: 14,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <View>
              <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '600' }}>TOTAL ASSETS</Text>
              <CurrencyText amount={netWorth.totalAssets} style={{ fontSize: 17, fontWeight: '800', color: '#34d399', marginTop: 2 }} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '600' }}>TOTAL LIABILITIES</Text>
              <CurrencyText amount={netWorth.totalLiabilities} style={{ fontSize: 17, fontWeight: '800', color: '#f87171', marginTop: 2 }} />
            </View>
          </View>
        </LinearGradient>

        {/* Smart Financial Intelligence Carousel */}
        <InsightsCarousel insights={insights} />

        {/* 30-Day Cashflow Runway Banner */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Hub')}
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            borderWidth: 1,
            borderColor: 'rgba(59, 130, 246, 0.25)',
            borderRadius: 18,
            padding: 14,
            marginBottom: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(59, 130, 246, 0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Compass size={20} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                {netWorth.projectedRunwayDays || 270} Days Liquid Runway
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                Safe burn buffer based on monthly burn of ₹{cashFlow.genuineExpense.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
          <ArrowRight size={16} color="#3b82f6" />
        </TouchableOpacity>

        {/* Asset Allocation Breakdown */}
        <Card style={{ marginBottom: 20, padding: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <PieChart size={18} color={colors.primary} />
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                Portfolio Allocation
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Investments')}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                View Markets
              </Text>
            </TouchableOpacity>
          </View>

          <AssetAllocationBar netWorth={netWorth} investments={investments} />
        </Card>

        {/* Quick Reserves & Owed Breakdown */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 22 }}>
          <Card style={{ flex: 1, padding: 16 }}>
            <PiggyBank size={20} color={colors.primary} />
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 10, fontWeight: '600' }}>
              Liquid Cash Reserves
            </Text>
            <CurrencyText amount={netWorth.liquidCash} style={{ fontSize: 19, marginTop: 4, fontWeight: '800' }} />
          </Card>

          <Card style={{ flex: 1, padding: 16 }}>
            <CreditCard size={20} color={colors.creditCard} />
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 10, fontWeight: '600' }}>
              Credit Owed
            </Text>
            <CurrencyText amount={netWorth.creditOutstanding} style={{ fontSize: 19, color: colors.debit, marginTop: 4, fontWeight: '800' }} />
          </Card>
        </View>

        {/* Recent Transactions Section */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
            Recent Activity
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Ledger')}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
              Full Ledger ({transactions.length})
            </Text>
          </TouchableOpacity>
        </View>

        {recentTransactions.map((tx) => (
          <Card key={tx.id} style={{ marginBottom: 10, padding: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                  {tx.clean_merchant || tx.normalized_narration}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {tx.account_name}
                  </Text>
                  {tx.category && (
                    <Badge label={tx.category} size="sm" variant={tx.direction === 'CREDIT' ? 'credit' : 'neutral'} />
                  )}
                </View>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <CurrencyText
                  amount={tx.amount}
                  colored
                  showSign
                  style={{ fontSize: 16, fontWeight: '800' }}
                />
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  {tx.transaction_date}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
};

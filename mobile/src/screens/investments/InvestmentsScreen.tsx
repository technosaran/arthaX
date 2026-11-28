import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  TrendingUp,
  PieChart,
  Coins,
  Gem,
  Award,
  CircleDollarSign,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Zap,
  Bitcoin,
  Building2,
  Calendar,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useFinancial } from '../../context/FinancialContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { CurrencyText } from '../../components/CurrencyText';
import { Badge } from '../../components/Badge';
import { sumMoney, subMoney } from '../../engine/money';
import { getScrollBottomPadding } from '../../theme/platform';

export const InvestmentsScreen = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { investments, stocks, mutualFunds, bullion, cryptoAssets, bonds, fnoPositions, isRefreshing, refreshData } = useFinancial();

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'STOCKS' | 'MUTUAL_FUNDS' | 'CRYPTO' | 'BONDS' | 'FNO' | 'BULLION'>('OVERVIEW');

  const totalInvested = sumMoney(investments.map((i) => i.investedValue));
  const totalCurrent = sumMoney(investments.map((i) => i.currentValue));
  const totalPnl = subMoney(totalCurrent, totalInvested);
  const overallReturnPercentage = totalInvested > 0 ? Number(((totalPnl / totalInvested) * 100).toFixed(2)) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="Markets & Portfolio"
        subtitle="Demat, F&O, Bonds, Crypto & Bullion"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: getScrollBottomPadding(insets.bottom) }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshData} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Live Bullion & Crypto Top Ticker */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          {bullion.map((b, idx) => (
            <View
              key={idx}
              style={{
                flex: 1,
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>{b.name}</Text>
                <CurrencyText amount={b.pricePerUnit} style={{ fontSize: 15, fontWeight: '800', marginTop: 2 }} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {b.dayChangePercentage >= 0 ? (
                    <ArrowUpRight size={12} color={colors.credit} />
                  ) : (
                    <ArrowDownRight size={12} color={colors.debit} />
                  )}
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: b.dayChangePercentage >= 0 ? colors.credit : colors.debit,
                    }}
                  >
                    {b.dayChangePercentage > 0 ? '+' : ''}{b.dayChangePercentage}%
                  </Text>
                </View>
                <Text style={{ fontSize: 9, color: colors.textMuted }}>per {b.unit}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Portfolio Hero Header Card */}
        <Card style={{ marginBottom: 18, backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1.5 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Total Investment Portfolio
            </Text>
            <Badge label="Zerodha + AMFI + Binance" size="sm" variant="primary" />
          </View>

          <CurrencyText amount={totalCurrent} style={{ fontSize: 32, fontWeight: '900', color: colors.text, marginVertical: 8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>TOTAL INVESTED</Text>
              <CurrencyText amount={totalInvested} style={{ fontSize: 15, fontWeight: '700', color: colors.textSecondary, marginTop: 2 }} />
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>OVERALL RETURNS</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <CurrencyText amount={totalPnl} colored showSign style={{ fontSize: 15, fontWeight: '800' }} />
                <Badge
                  label={`+${overallReturnPercentage.toFixed(2)}%`}
                  size="sm"
                  variant={totalPnl >= 0 ? 'credit' : 'debit'}
                />
              </View>
            </View>
          </View>
        </Card>

        {/* Navigation Tabs (Scrollable across all 6 asset classes) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['OVERVIEW', 'STOCKS', 'MUTUAL_FUNDS', 'CRYPTO', 'BONDS', 'FNO', 'BULLION'] as const).map((tab) => {
              const isSelected = activeTab === tab;
              const label =
                tab === 'OVERVIEW'
                  ? 'Overview'
                  : tab === 'STOCKS'
                  ? `Stocks (${stocks.length})`
                  : tab === 'MUTUAL_FUNDS'
                  ? `Mutual Funds (${mutualFunds.length})`
                  : tab === 'CRYPTO'
                  ? `Crypto (${cryptoAssets.length})`
                  : tab === 'BONDS'
                  ? `Bonds (${bonds.length})`
                  : tab === 'FNO'
                  ? `F&O (${fnoPositions.length})`
                  : 'Gold & SGB';
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 12,
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
        </ScrollView>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <View style={{ gap: 12 }}>
            {investments.map((asset) => {
              let Icon = TrendingUp;
              let iconBg = colors.primaryGlow;
              let iconColor = colors.primary;

              if (asset.assetClass === 'MUTUAL_FUNDS') {
                Icon = PieChart;
                iconBg = 'rgba(139, 92, 246, 0.15)';
                iconColor = colors.mutualFunds;
              } else if (asset.assetClass === 'GOLD_SILVER') {
                Icon = Gem;
                iconBg = 'rgba(234, 179, 8, 0.15)';
                iconColor = colors.gold;
              } else if (asset.assetClass === 'CRYPTO') {
                Icon = Bitcoin;
                iconBg = 'rgba(247, 147, 26, 0.15)';
                iconColor = '#f7931a';
              } else if (asset.assetClass === 'BONDS') {
                Icon = ShieldCheck;
                iconBg = 'rgba(6, 182, 212, 0.15)';
                iconColor = '#06b6d4';
              }

              return (
                <Card key={asset.id} style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={22} color={iconColor} />
                      </View>
                      <View>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                          {asset.name}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                          Invested: <CurrencyText amount={asset.investedValue} style={{ fontSize: 12, color: colors.textSecondary }} />
                        </Text>
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <CurrencyText amount={asset.currentValue} style={{ fontSize: 16, fontWeight: '700' }} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <CurrencyText amount={asset.pnl} colored showSign style={{ fontSize: 12, fontWeight: '600' }} />
                        <Text style={{ fontSize: 11, color: colors.credit, fontWeight: '700' }}>
                          ({asset.pnlPercentage.toFixed(1)}%)
                        </Text>
                      </View>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* TAB 2: STOCKS (Direct Equity) */}
        {activeTab === 'STOCKS' && (
          <View style={{ gap: 10 }}>
            {stocks.map((stk) => (
              <Card key={stk.id} style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                        {stk.symbol}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {stk.dayChangePercentage >= 0 ? (
                          <ArrowUpRight size={12} color={colors.credit} />
                        ) : (
                          <ArrowDownRight size={12} color={colors.debit} />
                        )}
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: stk.dayChangePercentage >= 0 ? colors.credit : colors.debit,
                          }}
                        >
                          {stk.dayChangePercentage > 0 ? '+' : ''}{stk.dayChangePercentage}%
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      {stk.name} • {stk.quantity} Qty @ <CurrencyText amount={stk.avgPrice} style={{ fontSize: 11 }} />
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <CurrencyText amount={stk.currentValue} style={{ fontSize: 16, fontWeight: '800' }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <CurrencyText amount={stk.totalPnl} colored showSign style={{ fontSize: 12, fontWeight: '700' }} />
                      <Text style={{ fontSize: 11, color: colors.credit, fontWeight: '700' }}>
                        ({stk.pnlPercentage.toFixed(1)}%)
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* TAB 3: MUTUAL FUNDS (AMFI SIPs) */}
        {activeTab === 'MUTUAL_FUNDS' && (
          <View style={{ gap: 10 }}>
            {mutualFunds.map((mf) => (
              <Card key={mf.id} style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }} numberOfLines={1}>
                      {mf.fundName}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      Folio: {mf.folioNumber} • NAV: ₹{mf.nav}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <CurrencyText amount={mf.currentValue} style={{ fontSize: 16, fontWeight: '800' }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Badge label={`${mf.xirr}% XIRR`} size="sm" variant="credit" />
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* TAB 4: CRYPTO & DIGITAL ASSETS */}
        {activeTab === 'CRYPTO' && (
          <View style={{ gap: 10 }}>
            {cryptoAssets.map((cry) => (
              <Card key={cry.id} style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                        {cry.name} ({cry.symbol})
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {cry.dayChangePercentage >= 0 ? (
                          <ArrowUpRight size={12} color={colors.credit} />
                        ) : (
                          <ArrowDownRight size={12} color={colors.debit} />
                        )}
                        <Text style={{ fontSize: 11, fontWeight: '700', color: cry.dayChangePercentage >= 0 ? colors.credit : colors.debit }}>
                          {cry.dayChangePercentage > 0 ? '+' : ''}{cry.dayChangePercentage}%
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      {cry.holdings} {cry.symbol} • Avg: <CurrencyText amount={cry.avgBuyPrice} style={{ fontSize: 11 }} />
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <CurrencyText amount={cry.currentValue} style={{ fontSize: 16, fontWeight: '800' }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <CurrencyText amount={cry.totalPnl} colored showSign style={{ fontSize: 12, fontWeight: '700' }} />
                      <Text style={{ fontSize: 11, color: colors.credit, fontWeight: '700' }}>
                        ({cry.pnlPercentage.toFixed(1)}%)
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* TAB 5: BONDS & FIXED INCOME */}
        {activeTab === 'BONDS' && (
          <View style={{ gap: 10 }}>
            {bonds.map((bnd) => (
              <Card key={bnd.id} style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                      {bnd.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      {bnd.issuer} • Maturity: {bnd.maturityDate}
                    </Text>
                    <Badge label={bnd.creditRating} size="sm" variant="primary" style={{ marginTop: 4 }} />
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <CurrencyText amount={bnd.currentValue} style={{ fontSize: 16, fontWeight: '800' }} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.credit, marginTop: 2 }}>
                      {bnd.couponRate}% Coupon
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* TAB 6: FUTURES & OPTIONS (F&O) */}
        {activeTab === 'FNO' && (
          <View style={{ gap: 10 }}>
            {fnoPositions.map((pos) => (
              <Card key={pos.id} style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
                        {pos.symbol}
                      </Text>
                      <Badge
                        label={pos.instrumentType}
                        size="sm"
                        variant={pos.instrumentType === 'CE' ? 'credit' : 'debit'}
                      />
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      {pos.quantity} Qty ({pos.lots} Lot) • Avg: ₹{pos.avgPrice} • LTP: ₹{pos.ltp}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <CurrencyText amount={pos.pnl} colored showSign style={{ fontSize: 16, fontWeight: '800' }} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: pos.pnl >= 0 ? colors.credit : colors.debit, marginTop: 2 }}>
                      ({pos.pnlPercentage > 0 ? '+' : ''}{pos.pnlPercentage}%)
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* TAB 7: BULLION & SGB */}
        {activeTab === 'BULLION' && (
          <View style={{ gap: 12 }}>
            <Card style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(234, 179, 8, 0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Gem size={22} color="#eab308" />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Sovereign Gold Bonds (SGB)</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>RBI 2.50% Annual Coupon • Capital Gains Tax Exempt</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>HOLDING VALUE</Text>
                  <CurrencyText amount={440000} style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 2 }} />
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>CAPITAL APPRECIATION</Text>
                  <CurrencyText amount={140000} colored showSign style={{ fontSize: 18, fontWeight: '800', marginTop: 2 }} />
                </View>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

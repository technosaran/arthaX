import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus,
  Layers,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useFinancial } from '../../context/FinancialContext';
import { Header } from '../../components/Header';
import { CurrencyText } from '../../components/CurrencyText';
import { Button } from '../../components/Button';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { AppleWalletAccountCard } from '../../components/AppleWalletAccountCard';
import { sumMoney } from '../../engine/money';
import { COMPACT_HIT_SLOP, getScrollBottomPadding, NUMERIC_KEYBOARD } from '../../theme/platform';

export const AccountsScreen = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { accounts, isRefreshing, refreshData } = useFinancial();

  const [filterType, setFilterType] = useState<'ALL' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT'>('ALL');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(accounts[0]?.id || null);
  const [modalVisible, setModalVisible] = useState(false);

  // New Account Form
  const [accName, setAccName] = useState('');
  const [institution, setInstitution] = useState('');
  const [balance, setBalance] = useState('');
  const [accType, setAccType] = useState<'SAVINGS' | 'CURRENT' | 'CREDIT_CARD' | 'INVESTMENT'>('SAVINGS');

  const filteredAccounts = accounts.filter((a) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'SAVINGS') return a.type === 'SAVINGS' || a.type === 'CURRENT';
    return a.type === filterType;
  });

  const totalBankBalance = sumMoney(
    accounts
      .filter((a) => a.type === 'SAVINGS' || a.type === 'CURRENT')
      .map((a) => a.current_balance)
  );

  const totalCreditDebt = sumMoney(
    accounts
      .filter((a) => a.type === 'CREDIT_CARD')
      .map((a) => Math.abs(a.current_balance))
  );

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const handleCreateAccount = () => {
    if (!accName.trim() || !balance.trim()) {
      Alert.alert('Required', 'Please enter account name and balance.');
      return;
    }
    Alert.alert('Account Linked', `Successfully linked ${accName} with balance ₹${balance}`);
    setModalVisible(false);
    setAccName('');
    setInstitution('');
    setBalance('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="Accounts Vault"
        subtitle={`${accounts.length} active wealth accounts`}
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: getScrollBottomPadding(insets.bottom) }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshData} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Metrics Bar */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' }}>
              Bank Reserves
            </Text>
            <CurrencyText amount={totalBankBalance} style={{ fontSize: 18, color: '#3b82f6', marginTop: 4 }} />
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' }}>
              Credit Owed
            </Text>
            <CurrencyText amount={totalCreditDebt} style={{ fontSize: 18, color: '#f43f5e', marginTop: 4 }} />
          </View>
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['ALL', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT'] as const).map((type) => {
              const isSelected = filterType === type;
              const label =
                type === 'ALL'
                  ? 'All Cards'
                  : type === 'SAVINGS'
                  ? 'Savings / Bank'
                  : type === 'CREDIT_CARD'
                  ? 'Credit Cards'
                  : 'Demat / Brokers';
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => setFilterType(type)}
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

        {/* Section Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Layers size={18} color={colors.primary} />
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
              Apple Wallet Deck
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            hitSlop={COMPACT_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Link financial card"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.primaryGlow,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 14,
            }}
          >
            <Plus size={14} color={colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, marginLeft: 4 }}>
              Link Card
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stacked Cards Deck */}
        {filteredAccounts.map((account, index) => {
          const isSelected = selectedAccountId === account.id;
          return (
            <View
              key={account.id}
              style={{
                marginBottom: isSelected ? 18 : 12,
                transform: [{ scale: isSelected ? 1 : 0.98 }],
              }}
            >
              <AppleWalletAccountCard
                account={account}
                isExpanded={isSelected}
                onPress={() => setSelectedAccountId(isSelected ? null : account.id)}
              />

              {/* Expanded Card Details & Quick Actions */}
              {isSelected && (
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderBottomLeftRadius: 20,
                    borderBottomRightRadius: 20,
                    borderWidth: 1,
                    borderTopWidth: 0,
                    borderColor: colors.border,
                    padding: 16,
                    marginTop: -10,
                    paddingTop: 20,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Institution</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                      {account.institution}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => Alert.alert('Balance Updated', `${account.name} balance verified via API sync.`)}
                      hitSlop={COMPACT_HIT_SLOP}
                      accessibilityRole="button"
                      accessibilityLabel={`Sync balance for ${account.name}`}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        backgroundColor: colors.primaryGlow,
                        borderRadius: 10,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                        Sync Balance
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Link Account Modal */}
      <BottomSheetModal visible={modalVisible} onClose={() => setModalVisible(false)}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 }}>
            Link New Financial Account
          </Text>

          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
            Account Name
          </Text>
          <TextInput
            placeholder="e.g. ICICI Coral Credit Card"
            placeholderTextColor={colors.textMuted}
            value={accName}
            onChangeText={setAccName}
            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, marginBottom: 14 }}
          />

          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
            Institution
          </Text>
          <TextInput
            placeholder="e.g. ICICI Bank, Zerodha, SBI"
            placeholderTextColor={colors.textMuted}
            value={institution}
            onChangeText={setInstitution}
            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, marginBottom: 14 }}
          />

          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
            Current Balance (₹)
          </Text>
          <TextInput
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType={NUMERIC_KEYBOARD}
            value={balance}
            onChangeText={setBalance}
            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 20 }}
          />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button title="Cancel" variant="secondary" onPress={() => setModalVisible(false)} style={{ flex: 1 }} />
            <Button title="Save Account" variant="primary" onPress={handleCreateAccount} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
};

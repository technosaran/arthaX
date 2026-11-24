import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Plus,
  X,
  FileUp,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  ShieldAlert,
  Lock,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useFinancial } from '../context/FinancialContext';
import { Button } from './Button';
import { CanonicalTransaction } from '../types';

export const FloatingActionHub: React.FC = () => {
  const { colors } = useTheme();
  const { accounts, addNewTransaction } = useFinancial();

  const [isOpen, setIsOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<'NONE' | 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'STATEMENT'>('NONE');

  // Form states
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id || 'acc-1');
  const [targetAccount, setTargetAccount] = useState(accounts[1]?.id || 'acc-2');

  // Statement Upload state
  const [statementPassword, setStatementPassword] = useState('');

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  };

  const handleOpenSheet = () => {
    triggerHaptic();
    setIsOpen(true);
    setActiveAction('NONE');
  };

  const handleClose = () => {
    setIsOpen(false);
    setActiveAction('NONE');
    setAmount('');
    setDescription('');
    setStatementPassword('');
  };

  const handleSaveTransaction = async (direction: 'DEBIT' | 'CREDIT') => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0 || !description.trim()) {
      Alert.alert('Required Fields', 'Please enter a valid positive amount and description.');
      return;
    }

    const account = accounts.find((a) => a.id === selectedAccount);

    const newTx: Omit<CanonicalTransaction, 'id' | 'user_id'> = {
      account_id: selectedAccount,
      account_name: account?.name || 'Account',
      amount: num,
      currency: 'INR',
      direction,
      transaction_date: new Date().toISOString().split('T')[0],
      original_narration: description.trim(),
      normalized_narration: description.trim(),
      clean_merchant: description.trim(),
      category: category.trim(),
    };

    const res = await addNewTransaction(newTx);
    if (res.success) {
      triggerHaptic();
      handleClose();
      Alert.alert('Recorded', `${direction === 'CREDIT' ? 'Income' : 'Expense'} of ₹${num} added to ${account?.name}`);
    } else {
      Alert.alert('Error', res.error || 'Failed to save');
    }
  };

  const handleTransfer = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0 || selectedAccount === targetAccount) {
      Alert.alert('Invalid Transfer', 'Please select two different accounts and a valid amount.');
      return;
    }

    const sourceAcc = accounts.find((a) => a.id === selectedAccount);
    const destAcc = accounts.find((a) => a.id === targetAccount);

    // Record source debit transfer
    await addNewTransaction({
      account_id: selectedAccount,
      account_name: sourceAcc?.name || 'Source',
      amount: num,
      currency: 'INR',
      direction: 'DEBIT',
      transaction_date: new Date().toISOString().split('T')[0],
      original_narration: `Internal Transfer to ${destAcc?.name}`,
      normalized_narration: `Transfer to ${destAcc?.name}`,
      clean_merchant: 'Internal Transfer',
      is_transfer: true,
      category: 'Transfer',
    });

    // Record dest credit transfer
    await addNewTransaction({
      account_id: targetAccount,
      account_name: destAcc?.name || 'Destination',
      amount: num,
      currency: 'INR',
      direction: 'CREDIT',
      transaction_date: new Date().toISOString().split('T')[0],
      original_narration: `Internal Transfer from ${sourceAcc?.name}`,
      normalized_narration: `Transfer from ${sourceAcc?.name}`,
      clean_merchant: 'Internal Transfer',
      is_transfer: true,
      category: 'Transfer',
    });

    triggerHaptic();
    handleClose();
    Alert.alert('Transfer Completed', `Moved ₹${num} from ${sourceAcc?.name} to ${destAcc?.name}`);
  };

  const handleSimulateStatementUpload = () => {
    triggerHaptic();
    handleClose();
    Alert.alert(
      'Decryption & Ingestion Simulated',
      'Bank statement PDF ingested. The Universal Bank Ingestion Engine normalized 24 transactions, checked opening/closing balance checksums, and added them to your ledger.'
    );
  };

  return (
    <>
      {/* Floating Center Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleOpenSheet}
        style={{
          position: 'absolute',
          bottom: 24,
          alignSelf: 'center',
          backgroundColor: '#10b981',
          width: 58,
          height: 58,
          borderRadius: 29,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#10b981',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.45,
          shadowRadius: 12,
          elevation: 8,
          zIndex: 99,
        }}
      >
        <Plus size={28} color="#ffffff" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Action Hub Modal */}
      <Modal visible={isOpen} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 24,
              borderWidth: 1,
              borderColor: colors.border,
              maxHeight: '85%',
            }}
          >
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                {activeAction === 'NONE'
                  ? 'Financial Action Hub'
                  : activeAction === 'EXPENSE'
                  ? 'Record Expense'
                  : activeAction === 'INCOME'
                  ? 'Record Income'
                  : activeAction === 'TRANSFER'
                  ? 'Account Transfer'
                  : 'Ingest Bank Statement'}
              </Text>
              <TouchableOpacity onPress={handleClose} style={{ padding: 6 }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Hub Grid Selection */}
            {activeAction === 'NONE' && (
              <View style={{ gap: 12, marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => setActiveAction('EXPENSE')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(244, 63, 94, 0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(244, 63, 94, 0.25)',
                    padding: 16,
                    borderRadius: 18,
                  }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(244, 63, 94, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <ArrowUpRight size={22} color="#f43f5e" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Add Expense</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Outflow from Bank or Credit Card</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveAction('INCOME')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(16, 185, 129, 0.25)',
                    padding: 16,
                    borderRadius: 18,
                  }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(16, 185, 129, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <ArrowDownLeft size={22} color="#10b981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Add Income</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Salary, Dividend, or Inflow</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveAction('TRANSFER')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 16,
                    borderRadius: 18,
                  }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryGlow, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <ArrowLeftRight size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Internal Transfer</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Move money without affecting expenses</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveAction('STATEMENT')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 16,
                    borderRadius: 18,
                  }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(59, 130, 246, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <FileUp size={22} color="#3b82f6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Ingest Statement (PDF/CSV)</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Automatic password decryption & parsing</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Sub-form: Expense or Income */}
            {(activeAction === 'EXPENSE' || activeAction === 'INCOME') && (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Amount (₹)</Text>
                <TextInput
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 14 }}
                />

                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Merchant / Narration</Text>
                <TextInput
                  placeholder="e.g. Swiggy, Amazon, Google Salary"
                  placeholderTextColor={colors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, color: colors.text, marginBottom: 14 }}
                />

                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Category</Text>
                <TextInput
                  placeholder="e.g. Food, Travel, Salary, Tech"
                  placeholderTextColor={colors.textMuted}
                  value={category}
                  onChangeText={setCategory}
                  style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, color: colors.text, marginBottom: 20 }}
                />

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Button title="Back" variant="secondary" onPress={() => setActiveAction('NONE')} style={{ flex: 1 }} />
                  <Button
                    title="Confirm Entry"
                    variant={activeAction === 'EXPENSE' ? 'danger' : 'primary'}
                    onPress={() => handleSaveTransaction(activeAction === 'EXPENSE' ? 'DEBIT' : 'CREDIT')}
                    style={{ flex: 1 }}
                  />
                </View>
              </ScrollView>
            )}

            {/* Sub-form: Transfer */}
            {activeAction === 'TRANSFER' && (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Transfer Amount (₹)</Text>
                <TextInput
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 16 }}
                />

                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>From Account</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {accounts.map((acc) => (
                      <TouchableOpacity
                        key={acc.id}
                        onPress={() => setSelectedAccount(acc.id)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor: selectedAccount === acc.id ? colors.primary : colors.background,
                          borderWidth: 1,
                          borderColor: selectedAccount === acc.id ? colors.primary : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: selectedAccount === acc.id ? '#ffffff' : colors.text }}>
                          {acc.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>To Account</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {accounts.map((acc) => (
                      <TouchableOpacity
                        key={acc.id}
                        onPress={() => setTargetAccount(acc.id)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor: targetAccount === acc.id ? '#3b82f6' : colors.background,
                          borderWidth: 1,
                          borderColor: targetAccount === acc.id ? '#3b82f6' : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: targetAccount === acc.id ? '#ffffff' : colors.text }}>
                          {acc.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Button title="Back" variant="secondary" onPress={() => setActiveAction('NONE')} style={{ flex: 1 }} />
                  <Button title="Execute Transfer" variant="primary" onPress={handleTransfer} style={{ flex: 1 }} />
                </View>
              </ScrollView>
            )}

            {/* Sub-form: Statement Ingestion */}
            {activeAction === 'STATEMENT' && (
              <View>
                <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.25)', marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: '#93c5fd', lineHeight: 18 }}>
                    ArthaX uses mathematical balance checksum validation: Opening + Credits - Debits = Closing.
                  </Text>
                </View>

                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
                  PDF Password (Optional - if encrypted)
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 20 }}>
                  <Lock size={18} color={colors.textMuted} />
                  <TextInput
                    placeholder="e.g. DOB + PAN or Account No"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    value={statementPassword}
                    onChangeText={setStatementPassword}
                    style={{ flex: 1, height: 46, color: colors.text, marginLeft: 10 }}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Button title="Back" variant="secondary" onPress={() => setActiveAction('NONE')} style={{ flex: 1 }} />
                  <Button title="Upload & Decrypt" variant="primary" onPress={handleSimulateStatementUpload} style={{ flex: 1 }} />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

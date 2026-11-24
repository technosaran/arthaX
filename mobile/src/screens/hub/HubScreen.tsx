import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import {
  Sparkles,
  PieChart,
  Receipt,
  Users,
  Bot,
  Zap,
  Target,
  Plus,
  Scale,
  AlertTriangle,
  ArrowRight,
  Shield,
  Clock,
  TrendingUp,
  TrendingDown,
  FileCheck,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useFinancial } from '../../context/FinancialContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { CurrencyText } from '../../components/CurrencyText';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { SavingsGoal } from '../../types';

export const HubScreen = () => {
  const { colors, isDark } = useTheme();
  const {
    goals,
    addNewGoal,
    cashFlow,
    budgetPacing,
    taxHarvesting,
    reconciliation,
  } = useFinancial();

  const [activeWorkspace, setActiveWorkspace] = useState<'PERSONAL' | 'FAMILY'>('PERSONAL');
  const [goalModalVisible, setGoalModalVisible] = useState(false);

  // New Goal Form
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');

  const categories = [
    { name: 'Food & Dining', spent: 28500, limit: 35000, color: '#f43f5e' },
    { name: 'Investments & SIPs', spent: 45000, limit: 50000, color: '#10b981' },
    { name: 'Shopping & Tech', spent: 14200, limit: 30000, color: '#3b82f6' },
    { name: 'Bills & Utilities', spent: 7300, limit: 10000, color: '#eab308' },
  ];

  const handleCreateGoal = () => {
    const target = parseFloat(goalTarget);
    const curr = parseFloat(goalCurrent || '0');
    if (!goalTitle.trim() || isNaN(target) || target <= 0) {
      Alert.alert('Required Fields', 'Please enter a goal title and target amount.');
      return;
    }

    addNewGoal({
      title: goalTitle.trim(),
      targetAmount: target,
      currentAmount: curr,
      category: 'EMERGENCY',
      deadline: goalDeadline.trim() || 'Dec 2027',
    });

    setGoalModalVisible(false);
    setGoalTitle('');
    setGoalTarget('');
    setGoalCurrent('');
    setGoalDeadline('');
    Alert.alert('Goal Added', `Created target for ${goalTitle}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="Intelligence Hub"
        subtitle="Cash Flow, Tax, Budgets & Family"
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Workspace Switcher (Personal vs Family) */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 4,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <TouchableOpacity
            onPress={() => setActiveWorkspace('PERSONAL')}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 12,
              backgroundColor: activeWorkspace === 'PERSONAL' ? colors.primary : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: activeWorkspace === 'PERSONAL' ? '#ffffff' : colors.textSecondary,
              }}
            >
              Personal Workspace
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveWorkspace('FAMILY')}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 12,
              backgroundColor: activeWorkspace === 'FAMILY' ? colors.primary : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: activeWorkspace === 'FAMILY' ? '#ffffff' : colors.textSecondary,
              }}
            >
              Family Workspace (3)
            </Text>
          </TouchableOpacity>
        </View>

        {/* 1. Cash Flow Analytics (Income vs Expenses) */}
        <Card style={{ marginBottom: 20, padding: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
              Monthly Cash Flow (Inflow vs Outflow)
            </Text>
            <Badge label={`+${cashFlow.savingsRate}% Saved`} variant="credit" size="sm" />
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={16} color={colors.credit} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>GENUINE INFLOW</Text>
              </View>
              <CurrencyText amount={cashFlow.genuineIncome} style={{ fontSize: 18, fontWeight: '800', color: colors.credit, marginTop: 4 }} />
              <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>Salary & Dividends</Text>
            </View>

            <View style={{ flex: 1, backgroundColor: 'rgba(244, 63, 94, 0.08)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(244, 63, 94, 0.2)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TrendingDown size={16} color={colors.debit} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>GENUINE OUTFLOW</Text>
              </View>
              <CurrencyText amount={cashFlow.genuineExpense} style={{ fontSize: 18, fontWeight: '800', color: colors.debit, marginTop: 4 }} />
              <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>Living & Lifestyle</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>NET MONTHLY SURPLUS</Text>
              {cashFlow.internalTransfersTotal > 0 && (
                <Text style={{ fontSize: 10, color: colors.textMuted }}>
                  (Excluded ₹{cashFlow.internalTransfersTotal.toLocaleString('en-IN')} internal transfers)
                </Text>
              )}
            </View>
            <CurrencyText amount={cashFlow.netSurplus} colored showSign style={{ fontSize: 16, fontWeight: '800' }} />
          </View>
        </Card>

        {/* 2. Monthly Budget & Burn Health */}
        <Card style={{ marginBottom: 20, padding: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <PieChart size={18} color={colors.primary} />
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                Category Spend Limits
              </Text>
            </View>
            <Badge
              label={budgetPacing.status === 'SAFE' ? 'Under Paced' : budgetPacing.status === 'ON_TRACK' ? 'On Track' : budgetPacing.status === 'OVERPACING' ? 'Over Pacing' : 'Budget Exceeded'}
              variant={budgetPacing.status === 'SAFE' ? 'credit' : budgetPacing.status === 'ON_TRACK' ? 'primary' : budgetPacing.status === 'OVERPACING' ? 'warning' : 'debit'}
              size="sm"
            />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }}>
            <View>
              <Text style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase' }}>Spent this month</Text>
              <CurrencyText amount={budgetPacing.spent} style={{ fontSize: 24, fontWeight: '900', marginTop: 2 }} />
            </View>
            <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600' }}>
              of <CurrencyText amount={budgetPacing.limit} style={{ fontSize: 13, color: colors.textSecondary }} />
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', marginVertical: 12 }}>
            <View
              style={{
                width: `${Math.min(100, budgetPacing.utilizationPercentage)}%`,
                backgroundColor: budgetPacing.status === 'EXCEEDED' ? colors.debit : budgetPacing.status === 'OVERPACING' ? '#f59e0b' : colors.primary,
                height: '100%',
                borderRadius: 4,
              }}
            />
          </View>

          {/* Pacing Alert if available */}
          {budgetPacing.alertMessage && (
            <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: 10, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' }}>
              <Text style={{ fontSize: 11, color: colors.credit, fontWeight: '600' }}>
                Day {budgetPacing.daysPassedInMonth} of {budgetPacing.totalDaysInMonth}: {budgetPacing.alertMessage}
              </Text>
            </View>
          )}

          {/* Category Breakdown */}
          {categories.map((cat, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cat.color }} />
                <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>{cat.name}</Text>
              </View>
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '700' }}>
                <CurrencyText amount={cat.spent} style={{ fontSize: 13 }} /> / <CurrencyText amount={cat.limit} style={{ fontSize: 13, color: colors.textMuted }} />
              </Text>
            </View>
          ))}
        </Card>

        {/* 3. Bank Statement Balance Reconciliation Checksum */}
        <Card style={{ marginBottom: 20, padding: 18, borderColor: reconciliation.isBalanced ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.5)', borderWidth: 1.5 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <FileCheck size={18} color="#3b82f6" />
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                Statement Reconciliation
              </Text>
            </View>
            <Badge
              label={reconciliation.isBalanced ? 'Checksum Verified ✓' : `Variance ₹${reconciliation.variance}`}
              variant={reconciliation.isBalanced ? 'primary' : 'debit'}
              size="sm"
            />
          </View>

          <View style={{ backgroundColor: colors.background, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 12, fontFamily: 'monospace', color: colors.textSecondary, lineHeight: 20 }}>
              Opening Balance: ₹{reconciliation.openingBalance.toLocaleString('en-IN')}{'\n'}
              + Total Credits: ₹{reconciliation.totalCredits.toLocaleString('en-IN')}{'\n'}
              - Total Debits:  ₹{reconciliation.totalDebits.toLocaleString('en-IN')}{'\n'}
              = Calculated:    ₹{reconciliation.expectedClosing.toLocaleString('en-IN')}{'\n'}
              Actual Closing:  ₹{reconciliation.closingBalance.toLocaleString('en-IN')} ({reconciliation.isBalanced ? 'Balanced 0.00' : `Delta: ${reconciliation.variance}`})
            </Text>
          </View>
        </Card>

        {/* 4. Savings Goals & Milestones */}
        <Card style={{ marginBottom: 20, padding: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Target size={18} color="#38bdf8" />
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                Savings Goals ({goals.length})
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setGoalModalVisible(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
              }}
            >
              <Plus size={14} color="#38bdf8" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#38bdf8', marginLeft: 4 }}>
                New Goal
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 14 }}>
            {goals.map((g) => {
              const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
              return (
                <View key={g.id} style={{ backgroundColor: colors.background, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>{g.title}</Text>
                    <Badge label={`${pct.toFixed(0)}%`} size="sm" variant={pct >= 80 ? 'credit' : 'primary'} />
                  </View>

                  <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginVertical: 10 }}>
                    <View style={{ width: `${pct}%`, backgroundColor: pct >= 80 ? colors.primary : '#38bdf8', height: '100%', borderRadius: 3 }} />
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      <CurrencyText amount={g.currentAmount} style={{ fontSize: 12, fontWeight: '700', color: colors.text }} /> of <CurrencyText amount={g.targetAmount} style={{ fontSize: 12 }} />
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} color={colors.textMuted} />
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>{g.deadline}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* 5. Tax Harvesting & Capital Gains (AFCE) */}
        <Card style={{ marginBottom: 20, padding: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Scale size={18} color="#f59e0b" />
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                Capital Gains Tax (FY 26-27)
              </Text>
            </View>
            <Badge label="Section 112A" variant="warning" size="sm" />
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
            <View style={{ flex: 1, backgroundColor: colors.background, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>LTCG Realized</Text>
              <CurrencyText amount={taxHarvesting.ltcgRealized} style={{ fontSize: 16, fontWeight: '800', color: colors.credit, marginTop: 2 }} />
              <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                ₹{(taxHarvesting.ltcgExemptionRemaining / 1000).toFixed(0)}k Exemption Left
              </Text>
            </View>

            <View style={{ flex: 1, backgroundColor: colors.background, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>Estimated Tax</Text>
              <CurrencyText amount={taxHarvesting.estimatedTaxPayable} style={{ fontSize: 16, fontWeight: '800', color: taxHarvesting.estimatedTaxPayable > 0 ? colors.debit : colors.primary, marginTop: 2 }} />
              <Text style={{ fontSize: 10, color: colors.credit, marginTop: 2 }}>
                {taxHarvesting.estimatedTaxPayable === 0 ? '₹0 Owed (Under Cap)' : '12.5% LTCG + 20% STCG'}
              </Text>
            </View>
          </View>

          {taxHarvesting.taxLossHarvestingPotential > 0 && (
            <TouchableOpacity
              onPress={() => Alert.alert(
                'Tax Loss Harvesting Candidates',
                taxHarvesting.harvestingCandidates.map(c => `${c.name}: Unrealized loss of ₹${c.unrealizedLoss.toLocaleString('en-IN')}`).join('\n') +
                '\n\nHarvesting these positions will offset taxable short/long-term capital gains under IT Act Section 112A provisions.'
              )}
              style={{
                marginTop: 14,
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                padding: 12,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderWidth: 1,
                borderColor: 'rgba(245, 158, 11, 0.25)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <AlertTriangle size={16} color="#f59e0b" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#f59e0b' }}>
                  Harvest Potential: Save ₹{Math.round(taxHarvesting.taxLossHarvestingPotential * 0.125).toLocaleString('en-IN')}
                </Text>
              </View>
              <ArrowRight size={14} color="#f59e0b" />
            </TouchableOpacity>
          )}
        </Card>

        {/* 6. Automation Matrix */}
        <Card style={{ marginBottom: 20, padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Zap size={18} color="#38bdf8" />
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
              Automation Matrix
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Bot size={18} color="#22c55e" />
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Telegram Bot</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>@Artha_X_bot active for alerts</Text>
                </View>
              </View>
              <Badge label="Online" variant="credit" size="sm" />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Receipt size={18} color="#38bdf8" />
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Apple Siri Shortcuts</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>"Hey Siri, log 350 for lunch"</Text>
                </View>
              </View>
              <Badge label="Synced" variant="primary" size="sm" />
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Add Goal Modal */}
      <Modal visible={goalModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 }}>
              Create Savings Target
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              Goal Name
            </Text>
            <TextInput
              placeholder="e.g. New Electric Car, Europe Trip"
              placeholderTextColor={colors.textMuted}
              value={goalTitle}
              onChangeText={setGoalTitle}
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, marginBottom: 14 }}
            />

            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              Target Amount (₹)
            </Text>
            <TextInput
              placeholder="500000"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={goalTarget}
              onChangeText={setGoalTarget}
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 14 }}
            />

            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              Already Saved Amount (₹)
            </Text>
            <TextInput
              placeholder="100000"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={goalCurrent}
              onChangeText={setGoalCurrent}
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, marginBottom: 14 }}
            />

            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              Target Deadline
            </Text>
            <TextInput
              placeholder="e.g. Dec 2027"
              placeholderTextColor={colors.textMuted}
              value={goalDeadline}
              onChangeText={setGoalDeadline}
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, marginBottom: 20 }}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button title="Cancel" variant="secondary" onPress={() => setGoalModalVisible(false)} style={{ flex: 1 }} />
              <Button title="Create Goal" variant="primary" onPress={handleCreateGoal} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

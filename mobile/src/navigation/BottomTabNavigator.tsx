import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  LayoutDashboard,
  CreditCard,
  ReceiptText,
  TrendingUp,
  Sparkles,
  Settings,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { AccountsScreen } from '../screens/accounts/AccountsScreen';
import { TransactionsScreen } from '../screens/transactions/TransactionsScreen';
import { InvestmentsScreen } from '../screens/investments/InvestmentsScreen';
import { HubScreen } from '../screens/hub/HubScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { FloatingActionHub } from '../components/FloatingActionHub';

const Tab = createBottomTabNavigator();

export const BottomTabNavigator = () => {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.borderSubtle,
            borderTopWidth: 1,
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: colors.tabBarActive,
          tabBarInactiveTintColor: colors.tabBarInactive,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
          },
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            tabBarLabel: 'Wealth',
            tabBarIcon: ({ color, size }) => <LayoutDashboard size={size - 2} color={color} />,
          }}
        />
        <Tab.Screen
          name="Accounts"
          component={AccountsScreen}
          options={{
            tabBarLabel: 'Cards',
            tabBarIcon: ({ color, size }) => <CreditCard size={size - 2} color={color} />,
          }}
        />
        <Tab.Screen
          name="Ledger"
          component={TransactionsScreen}
          options={{
            tabBarLabel: 'Ledger',
            tabBarIcon: ({ color, size }) => <ReceiptText size={size - 2} color={color} />,
          }}
        />
        <Tab.Screen
          name="Investments"
          component={InvestmentsScreen}
          options={{
            tabBarLabel: 'Markets',
            tabBarIcon: ({ color, size }) => <TrendingUp size={size - 2} color={color} />,
          }}
        />
        <Tab.Screen
          name="Hub"
          component={HubScreen}
          options={{
            tabBarLabel: 'Hub',
            tabBarIcon: ({ color, size }) => <Sparkles size={size - 2} color={color} />,
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: 'Settings',
            tabBarIcon: ({ color, size }) => <Settings size={size - 2} color={color} />,
          }}
        />
      </Tab.Navigator>

      {/* Global Floating Action Hub (FAB) */}
      <FloatingActionHub />
    </View>
  );
};

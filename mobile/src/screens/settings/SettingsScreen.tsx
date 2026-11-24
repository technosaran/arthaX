import React from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, Alert } from 'react-native';
import {
  User,
  Moon,
  Sun,
  Globe,
  Database,
  MessageSquare,
  Bot,
  Zap,
  LogOut,
  ChevronRight,
  Shield,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/Header';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';

export const SettingsScreen = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, isDemoUser, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Settings" subtitle="Preferences & Automations" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
        {/* User Profile Card */}
        <Card style={{ marginBottom: 20, padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: colors.primaryGlow,
                borderWidth: 1.5,
                borderColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User size={26} color={colors.primary} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
                {user?.user_metadata?.full_name || (isDemoUser ? 'Demo Account' : 'ArthaX Member')}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                {user?.email || (isDemoUser ? 'demo@arthax.finance' : 'Connected')}
              </Text>
            </View>

            {isDemoUser && (
              <Badge label="Demo" variant="warning" size="sm" />
            )}
          </View>
        </Card>

        {/* Appearance & Preferences */}
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
          Preferences
        </Text>
        <Card style={{ marginBottom: 20, padding: 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {isDark ? <Moon size={20} color={colors.primary} /> : <Sun size={20} color={colors.warning} />}
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                Dark Theme
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Globe size={20} color={colors.textSecondary} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                Currency Standard
              </Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>
              ₹ INR (Indian Rupee)
            </Text>
          </View>
        </Card>

        {/* Connected Automations */}
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
          Integrations & Ingestion
        </Text>
        <Card style={{ marginBottom: 20, padding: 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Bot size={20} color="#22c55e" />
              <View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Telegram Bot</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>@Artha_X_bot</Text>
              </View>
            </View>
            <Badge label="Online" variant="credit" size="sm" />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <MessageSquare size={20} color="#25D366" />
              <View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>WhatsApp Cloud API</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Instant bank alert ingestion</Text>
              </View>
            </View>
            <Badge label="Active" variant="credit" size="sm" />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Zap size={20} color="#38bdf8" />
              <View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Apple Shortcuts / Siri</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>One-tap voice expenses</Text>
              </View>
            </View>
            <Badge label="Ready" variant="primary" size="sm" />
          </View>
        </Card>

        {/* Database & Cloud Security */}
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
          System & Security
        </Text>
        <Card style={{ marginBottom: 24, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Shield size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                Supabase PostgreSQL with RLS
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                Row Level Security & AES-256 encrypted vaults
              </Text>
            </View>
            <Badge label="Connected" variant="credit" size="sm" />
          </View>
        </Card>

        {/* Sign Out Button */}
        <Button
          title={isDemoUser ? 'Exit Demo Mode' : 'Sign Out'}
          variant="danger"
          onPress={handleSignOut}
          icon={<LogOut size={18} color="#ffffff" />}
          size="lg"
        />
      </ScrollView>
    </View>
  );
};

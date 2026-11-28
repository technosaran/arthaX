import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Shield,
  Sparkles,
  ArrowRight,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { GoogleIcon } from '../../components/GoogleIcon';

export const LoginScreen = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, enterDemoMode } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const passwordInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const isSignUp = mode === 'signup';

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please enter your email and password.');
      return;
    }

    triggerHaptic();
    setLoading(true);
    if (isSignUp) {
      const res = await signUpWithEmail(email.trim(), password.trim(), name.trim());
      setLoading(false);
      if (res.error) {
        Alert.alert('Registration Error', res.error);
      } else {
        Alert.alert('Account Created', 'Your account has been registered! You can now sign in.');
        setMode('signin');
      }
    } else {
      const res = await signInWithEmail(email.trim(), password.trim());
      setLoading(false);
      if (res.error) {
        Alert.alert('Sign In Failed', res.error);
      }
    }
  };

  const handleGoogleLogin = async () => {
    triggerHaptic();
    setGoogleLoading(true);
    const res = await signInWithGoogle();
    setGoogleLoading(false);
    if (res.error) {
      Alert.alert('Google Sign-In', res.error);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          justifyContent: 'center',
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {/* Glow Header */}
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <LinearGradient
            colors={['rgba(16, 185, 129, 0.25)', 'transparent']}
            style={{
              position: 'absolute',
              top: -40,
              width: 240,
              height: 120,
              borderRadius: 60,
            }}
          />

          {/* Logo Badge */}
          <View
            style={{
              width: 68,
              height: 68,
              borderRadius: 22,
              backgroundColor: '#111827',
              borderWidth: 1.5,
              borderColor: '#10b981',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#10b981',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 14,
              elevation: 8,
              marginBottom: 14,
            }}
          >
            <Shield size={34} color="#10b981" />
          </View>

          <Text style={{ fontSize: 32, fontWeight: '900', color: colors.text, letterSpacing: -1 }}>
            Artha<Text style={{ color: colors.primary }}>X</Text>
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 16,
              marginTop: 6,
              borderWidth: 1,
              borderColor: 'rgba(16, 185, 129, 0.2)',
            }}
          >
            <CheckCircle2 size={12} color="#10b981" />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#10b981', marginLeft: 4, letterSpacing: 0.5 }}>
              FINANCIAL AUTOMATION OS
            </Text>
          </View>
        </View>

        {/* Main Card */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 22,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.4 : 0.08,
            shadowRadius: 16,
            elevation: 4,
          }}
        >
          {/* Segmented Switcher (Sign In vs Sign Up) */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: isDark ? '#090d16' : '#f1f5f9',
              borderRadius: 14,
              padding: 4,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                triggerHaptic();
                setMode('signin');
              }}
              style={{
                flex: 1,
                paddingVertical: 9,
                alignItems: 'center',
                borderRadius: 10,
                backgroundColor: !isSignUp ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                shadowColor: '#000',
                shadowOpacity: !isSignUp ? 0.1 : 0,
                shadowRadius: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: !isSignUp ? '700' : '500',
                  color: !isSignUp ? colors.text : colors.textSecondary,
                }}
              >
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                triggerHaptic();
                setMode('signup');
              }}
              style={{
                flex: 1,
                paddingVertical: 9,
                alignItems: 'center',
                borderRadius: 10,
                backgroundColor: isSignUp ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                shadowColor: '#000',
                shadowOpacity: isSignUp ? 0.1 : 0,
                shadowRadius: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: isSignUp ? '700' : '500',
                  color: isSignUp ? colors.text : colors.textSecondary,
                }}
              >
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Google Sign In Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleGoogleLogin}
            disabled={googleLoading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? '#1a2234' : '#ffffff',
              borderWidth: 1,
              borderColor: isDark ? '#2d3a54' : '#e2e8f0',
              borderRadius: 14,
              paddingVertical: 13,
              marginBottom: 18,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <GoogleIcon size={20} />
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: colors.text,
                    marginLeft: 10,
                  }}
                >
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ marginHorizontal: 12, fontSize: 12, color: colors.textMuted, fontWeight: '500' }}>
              or email & password
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          {/* Name Field (Sign Up Only) */}
          {isSignUp && (
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
                Full Name
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? '#090d16' : '#f8fafc',
                  borderWidth: 1.5,
                  borderColor: focusedField === 'name' ? colors.primary : colors.border,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  height: 48,
                }}
              >
                <User size={18} color={focusedField === 'name' ? colors.primary : colors.textMuted} />
                <TextInput
                  placeholder="e.g. Saran R"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoComplete="name"
                  textContentType="name"
                  autoCapitalize="words"
                  returnKeyType="next"
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    flex: 1,
                    height: '100%',
                    color: colors.text,
                    marginLeft: 10,
                    fontSize: 15,
                  }}
                />
              </View>
            </View>
          )}

          {/* Email Field */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              Email Address
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? '#090d16' : '#f8fafc',
                borderWidth: 1.5,
                borderColor: focusedField === 'email' ? colors.primary : colors.border,
                borderRadius: 14,
                paddingHorizontal: 14,
                height: 48,
              }}
            >
              <Mail size={18} color={focusedField === 'email' ? colors.primary : colors.textMuted} />
              <TextInput
                placeholder="name@example.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                style={{
                  flex: 1,
                  height: '100%',
                  color: colors.text,
                  marginLeft: 10,
                  fontSize: 15,
                }}
              />
            </View>
          </View>

          {/* Password Field */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              Password
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? '#090d16' : '#f8fafc',
                borderWidth: 1.5,
                borderColor: focusedField === 'password' ? colors.primary : colors.border,
                borderRadius: 14,
                paddingHorizontal: 14,
                height: 48,
              }}
            >
              <Lock size={18} color={focusedField === 'password' ? colors.primary : colors.textMuted} />
              <TextInput
                ref={passwordInputRef}
                placeholder="••••••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                textContentType={isSignUp ? 'newPassword' : 'password'}
                returnKeyType="done"
                onSubmitEditing={handleAuth}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                style={{
                  flex: 1,
                  height: '100%',
                  color: colors.text,
                  marginLeft: 10,
                  fontSize: 15,
                }}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff size={18} color={colors.textMuted} />
                ) : (
                  <Eye size={18} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleAuth}
            disabled={loading}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 14,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 4,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700', marginRight: 8 }}>
                  {isSignUp ? 'Create My Account' : 'Sign In to ArthaX'}
                </Text>
                <ArrowRight size={18} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Demo Mode Exploration Box */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            triggerHaptic();
            enterDemoMode();
          }}
          style={{
            marginTop: 20,
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(241, 245, 249, 0.8)',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 18,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: colors.primaryGlow,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Sparkles size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                Explore Demo Mode
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                Instant preview with live sample portfolios
              </Text>
            </View>
          </View>
          <ArrowRight size={16} color={colors.primary} />
        </TouchableOpacity>

        {/* Security Badge */}
        <View style={{ alignItems: 'center', marginTop: 24 }}>
          <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center' }}>
            🔒 AES-256 Encrypted Vaults • Supabase Strict RLS
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

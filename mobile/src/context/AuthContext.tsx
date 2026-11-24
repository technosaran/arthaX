import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../api/supabase';

// Complete WebBrowser auth session on redirect
WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isDemoUser: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  enterDemoMode: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isDemoUser: false,
  signInWithEmail: async () => ({}),
  signUpWithEmail: async () => ({}),
  signInWithGoogle: async () => ({}),
  enterDemoMode: () => {},
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoUser, setIsDemoUser] = useState(false);

  useEffect(() => {
    // Check demo mode state first
    AsyncStorage.getItem('@arthax_demo_mode').then((isDemo) => {
      if (isDemo === 'true') {
        setIsDemoUser(true);
      }
    });

    // Check active Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsDemoUser(false);
        AsyncStorage.removeItem('@arthax_demo_mode');
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, pass: string) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    setIsLoading(false);
    if (error) return { error: error.message };
    setIsDemoUser(false);
    await AsyncStorage.removeItem('@arthax_demo_mode');
    return {};
  };

  const signUpWithEmail = async (email: string, pass: string, name?: string) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: { full_name: name || email.split('@')[0] },
      },
    });
    setIsLoading(false);
    if (error) return { error: error.message };
    return {};
  };

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'arthax://auth/callback',
          skipBrowserRedirect: true,
          scopes: 'email profile openid',
        },
      });

      if (error) {
        setIsLoading(false);
        return { error: error.message };
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, 'arthax://auth/callback');
        if (result.type === 'success' && result.url) {
          const urlObj = new URL(result.url);
          const params = new URLSearchParams(urlObj.hash.substring(1) || urlObj.search);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            setIsDemoUser(false);
            await AsyncStorage.removeItem('@arthax_demo_mode');
          }
        }
      }
      setIsLoading(false);
      return {};
    } catch (err: any) {
      setIsLoading(false);
      return { error: err.message || 'Google sign-in was interrupted.' };
    }
  };

  const enterDemoMode = () => {
    setIsDemoUser(true);
    AsyncStorage.setItem('@arthax_demo_mode', 'true');
  };

  const signOut = async () => {
    await AsyncStorage.removeItem('@arthax_demo_mode');
    setIsDemoUser(false);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isDemoUser,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        enterDemoMode,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

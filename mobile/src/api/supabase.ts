import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra as Record<string, string> | undefined) || {};

export const SUPABASE_URL: string = 
  process.env.EXPO_PUBLIC_SUPABASE_URL || 
  extra.supabaseUrl || 
  'https://fvpfzbuoizzjwgekuhot.supabase.co';

export const SUPABASE_ANON_KEY: string = 
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  extra.supabaseAnonKey || 
  'sb_publishable_eb8KMAHsO_TnQgkhswFBXg_7tcL1qq4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

interface UserProfile {
  name: string;
  theme: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchProfile = useCallback(async (userId: string, defaultName?: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("user_settings")
        .select("name, theme")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        setProfile({
          name: data.name || defaultName || "User",
          theme: data.theme || "ultra",
        });
      } else if (!error) {
        // Fallback upsert if profile record was not created
        const nameToSet = defaultName || "User";
        await supabase.from("user_settings").upsert({
          id: userId,
          name: nameToSet,
          theme: "ultra",
        });
        setProfile({ name: nameToSet, theme: "ultra" });
      }
    } catch (err) {
      console.warn("Failed to fetch user profile:", err);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const fallbackName =
          currentUser.user_metadata?.full_name ||
          currentUser.user_metadata?.name ||
          currentUser.email?.split("@")[0] ||
          "User";
        fetchProfile(currentUser.id, fallbackName);
      }
      setLoading(false);
    });

    // 2. Listen to auth state transitions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const fallbackName =
          currentUser.user_metadata?.full_name ||
          currentUser.user_metadata?.name ||
          currentUser.email?.split("@")[0] ||
          "User";
        fetchProfile(currentUser.id, fallbackName);
      } else {
        setProfile(null);
      }

      setLoading(false);
      router.refresh();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile, router]);

  // Real-time synchronization for user profile & settings across devices
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-auth-profile-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_settings",
          filter: `id=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload.new) {
            setProfile((prev) => ({
              name: payload.new.name || prev?.name || "User",
              theme: payload.new.theme || prev?.theme || "ultra",
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.push("/login");
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

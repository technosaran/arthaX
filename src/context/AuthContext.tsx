"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
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
  updateProfileLocally: (updates: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  updateProfileLocally: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = window.localStorage.getItem("arthax_cached_profile");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const inFlightFetchRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string, defaultName?: string) => {
    if (inFlightFetchRef.current === userId) return;
    inFlightFetchRef.current = userId;

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("user_settings")
        .select("name, theme")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        const newProf = {
          name: data.name || defaultName || "User",
          theme: data.theme === "light" ? "light" : "dark",
        };
        setProfile(newProf);
        try {
          window.localStorage.setItem("arthax_cached_profile", JSON.stringify(newProf));
        } catch {}
      } else if (!error) {
        // Fallback upsert if profile record was not created
        const nameToSet = defaultName || "User";
        await supabase.from("user_settings").upsert({
          id: userId,
          name: nameToSet,
          theme: "dark",
        });
        const newProf = { name: nameToSet, theme: "dark" };
        setProfile(newProf);
        try {
          window.localStorage.setItem("arthax_cached_profile", JSON.stringify(newProf));
        } catch {}
      }
    } catch (err) {
      console.warn("Failed to fetch user profile:", err);
    } finally {
      inFlightFetchRef.current = null;
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
        try {
          window.localStorage.removeItem("arthax_cached_profile");
        } catch {}
      }

      setLoading(false);
      if (event === "SIGNED_OUT") {
        router.push("/login");
      }
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
            setProfile((prev) => {
              const updated = {
                name: payload.new.name || prev?.name || "User",
                theme: payload.new.theme === "light" ? "light" : "dark",
              };
              try {
                window.localStorage.setItem("arthax_cached_profile", JSON.stringify(updated));
              } catch {}
              return updated;
            });
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
    try {
      window.localStorage.removeItem("arthax_cached_profile");
    } catch {}
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

  const updateProfileLocally = useCallback((updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      const merged = {
        name: updates.name !== undefined ? updates.name : (prev?.name || "User"),
        theme: updates.theme !== undefined ? updates.theme : (prev?.theme || "dark"),
      };
      try {
        window.localStorage.setItem("arthax_cached_profile", JSON.stringify(merged));
      } catch {}
      return merged;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signOut,
        refreshProfile,
        updateProfileLocally,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

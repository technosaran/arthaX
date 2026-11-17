"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { clearLocalFinancialCache } from "@/utils/cacheClient";

interface UserProfile {
  name: string;
  theme: string;
  telegram_chat_id?: string | null;
  telegram_username?: string | null;
  telegram_link_token?: string | null;
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const inFlightFetchRef = useRef<string | null>(null);
  const profileFetchedForRef = useRef<string | null>(null);

  const updateUserSafely = useCallback((currentUser: User | null) => {
    setUser((prev) => {
      if (!prev && !currentUser) return null;
      if (
        prev &&
        currentUser &&
        prev.id === currentUser.id &&
        prev.email === currentUser.email &&
        prev.user_metadata?.avatar_url === currentUser.user_metadata?.avatar_url &&
        prev.user_metadata?.full_name === currentUser.user_metadata?.full_name
      ) {
        return prev;
      }
      return currentUser;
    });
  }, []);

  const updateProfileSafely = useCallback(
    (updater: UserProfile | null | ((prev: UserProfile | null) => UserProfile | null)) => {
      setProfile((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (!prev && !next) return null;
        if (
          prev &&
          next &&
          prev.name === next.name &&
          prev.theme === next.theme &&
          prev.telegram_chat_id === next.telegram_chat_id &&
          prev.telegram_username === next.telegram_username &&
          prev.telegram_link_token === next.telegram_link_token
        ) {
          return prev;
        }
        return next;
      });
    },
    []
  );

  const fetchProfile = useCallback(
    async (userId: string, defaultName?: string, force = false) => {
      if (!userId) return;
      if (!force && (inFlightFetchRef.current === userId || profileFetchedForRef.current === userId)) {
        return;
      }
      inFlightFetchRef.current = userId;

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("user_settings")
          .select("name, theme, telegram_chat_id, telegram_username, telegram_link_token")
          .eq("id", userId)
          .maybeSingle();

        if (data) {
          const newProf: UserProfile = {
            name: data.name || defaultName || "User",
            theme: data.theme === "light" ? "light" : "dark",
            telegram_chat_id: data.telegram_chat_id || null,
            telegram_username: data.telegram_username || null,
            telegram_link_token: data.telegram_link_token || null,
          };
          updateProfileSafely(newProf);
          profileFetchedForRef.current = userId;
          try {
            window.localStorage.setItem(`arthax_cached_profile_${userId}`, JSON.stringify(newProf));
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
          updateProfileSafely(newProf);
          profileFetchedForRef.current = userId;
          try {
            window.localStorage.setItem(`arthax_cached_profile_${userId}`, JSON.stringify(newProf));
          } catch {}
        } else {
          // Fallback in case of temporary query error so profile is never blank
          if (defaultName) {
            updateProfileSafely((prev) => prev || { name: defaultName, theme: "dark" });
          }
        }
      } catch (err) {
        console.warn("Failed to fetch user profile:", err);
        if (defaultName) {
          updateProfileSafely((prev) => prev || { name: defaultName, theme: "dark" });
        }
      } finally {
        inFlightFetchRef.current = null;
      }
    },
    [updateProfileSafely]
  );

  useEffect(() => {
    const supabase = createClient();

    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      updateUserSafely(currentUser);
      if (currentUser) {
        try {
          const cached = window.localStorage.getItem(`arthax_cached_profile_${currentUser.id}`);
          if (cached) {
            updateProfileSafely(JSON.parse(cached));
          }
        } catch {}

        const fallbackName =
          currentUser.user_metadata?.full_name ||
          currentUser.user_metadata?.name ||
          currentUser.email?.split("@")[0] ||
          "User";
        updateProfileSafely((prev) => prev || { name: fallbackName, theme: "dark" });
        fetchProfile(currentUser.id, fallbackName);
      }
      setLoading(false);
    });

    // 2. Listen to auth state transitions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      updateUserSafely(currentUser);

      if (currentUser) {
        try {
          const cached = window.localStorage.getItem(`arthax_cached_profile_${currentUser.id}`);
          if (cached) {
            updateProfileSafely(JSON.parse(cached));
          }
        } catch {}

        const fallbackName =
          currentUser.user_metadata?.full_name ||
          currentUser.user_metadata?.name ||
          currentUser.email?.split("@")[0] ||
          "User";
        updateProfileSafely((prev) => prev || { name: fallbackName, theme: "dark" });
        fetchProfile(currentUser.id, fallbackName);
      } else {
        profileFetchedForRef.current = null;
        updateProfileSafely(null);
        clearLocalFinancialCache();
      }

      setLoading(false);
      if (event === "SIGNED_OUT") {
        profileFetchedForRef.current = null;
        clearLocalFinancialCache();
        router.push("/login");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile, router, updateUserSafely, updateProfileSafely]);

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
              const updated: UserProfile = {
                name: payload.new.name || prev?.name || "User",
                theme: payload.new.theme === "light" ? "light" : "dark",
                telegram_chat_id: payload.new.telegram_chat_id !== undefined ? payload.new.telegram_chat_id : (prev?.telegram_chat_id ?? null),
                telegram_username: payload.new.telegram_username !== undefined ? payload.new.telegram_username : (prev?.telegram_username ?? null),
                telegram_link_token: payload.new.telegram_link_token !== undefined ? payload.new.telegram_link_token : (prev?.telegram_link_token ?? null),
              };
              try {
                if (user?.id) {
                  window.localStorage.setItem(`arthax_cached_profile_${user.id}`, JSON.stringify(updated));
                }
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
    clearLocalFinancialCache();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.push("/login");
  };

  const refreshProfile = async () => {
    if (user) {
      inFlightFetchRef.current = null;
      profileFetchedForRef.current = null;
      await fetchProfile(user.id, undefined, true);
    }
  };

  const updateProfileLocally = useCallback((updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      const merged = {
        name: updates.name !== undefined ? updates.name : (prev?.name || "User"),
        theme: updates.theme !== undefined ? updates.theme : (prev?.theme || "dark"),
      };
      try {
        if (user?.id) {
          window.localStorage.setItem(`arthax_cached_profile_${user.id}`, JSON.stringify(merged));
        }
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

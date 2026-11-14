"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type ThemeMode = "light" | "dark";

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: async () => {},
  loading: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("arthax_theme");
      if (saved === "light" || saved === "dark") {
        return saved;
      }
    }
    return "dark";
  });
  const [loading, setLoading] = useState(true);

  // Apply theme to DOM
  const applyThemeToDOM = (t: ThemeMode) => {
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.style.colorScheme = t === "light" ? "light" : "dark";
    if (t === "light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    }
  };

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  // Fetch theme directly from Supabase database when user logs in
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const fetchTheme = async () => {
      try {
        const { data } = await supabase
          .from("user_settings")
          .select("theme")
          .eq("id", user.id)
          .maybeSingle();

        if (data?.theme && (data.theme === "light" || data.theme === "dark")) {
          setThemeState(data.theme);
          applyThemeToDOM(data.theme);
          localStorage.setItem("arthax_theme", data.theme);
        } else if (data?.theme === "ultra") {
          // Normalize legacy ultra theme to dark
          setThemeState("dark");
          applyThemeToDOM("dark");
          localStorage.setItem("arthax_theme", "dark");
          supabase.from("user_settings").update({ theme: "dark" }).eq("id", user.id).then();
        }
      } catch (err) {
        console.warn("Failed to load user theme from Supabase:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTheme();

    // Cross-device Realtime channel for user theme
    const channel = supabase
      .channel(`realtime-theme-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_settings",
          filter: `id=eq.${user.id}`,
        },
        (payload: any) => {
          const newTheme = payload.new?.theme;
          if (newTheme && (newTheme === "light" || newTheme === "dark")) {
            setThemeState(newTheme);
            applyThemeToDOM(newTheme);
            localStorage.setItem("arthax_theme", newTheme);
          } else if (newTheme === "ultra") {
            setThemeState("dark");
            applyThemeToDOM("dark");
            localStorage.setItem("arthax_theme", "dark");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Save theme directly to Supabase database (broadcasts to all other devices)
  const setTheme = async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    applyThemeToDOM(newTheme);
    localStorage.setItem("arthax_theme", newTheme);

    if (user) {
      try {
        const supabase = createClient();
        await supabase
          .from("user_settings")
          .upsert({
            id: user.id,
            theme: newTheme,
            updated_at: new Date().toISOString(),
          });
      } catch (err) {
        console.warn("Failed to save theme to Supabase:", err);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

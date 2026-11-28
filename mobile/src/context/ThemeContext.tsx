import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, ThemeColors } from '../theme/colors';

const syncNativeColorScheme = (dark: boolean) => {
  if (Platform.OS !== 'web') {
    Appearance.setColorScheme?.(dark ? 'dark' : 'light');
  }
};

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('@arthax_theme').then((saved) => {
      const dark = saved ? saved === 'dark' : true;
      setIsDark(dark);
      syncNativeColorScheme(dark);
    });
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem('@arthax_theme', next ? 'dark' : 'light');
      syncNativeColorScheme(next);
      return next;
    });
  };

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

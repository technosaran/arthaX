import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { FinancialProvider } from './src/context/FinancialContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <FinancialProvider>
            <AppNavigator />
          </FinancialProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

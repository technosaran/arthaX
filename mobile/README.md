# ArthaX Mobile (Expo / React Native)

Universal Financial Automation & Intelligence Mobile App for **Android** and **iOS**.

---

## 📱 Features

- **Live Supabase Sync:** Connects to PostgreSQL backend with Row Level Security (RLS) & AsyncStorage persistent auth.
- **Fintech Dark / Light Theme:** Custom financial palette (Emerald green, midnight slate, card elevation, high-contrast indicators).
- **Net Worth & Liquidity Overview:** Assets vs Liabilities, liquid cash, credit card debt, and annual return indicators.
- **Multi-Account Tracker:** Real-time balances for Savings, Current, Credit Cards, and Demat/Trading wallets.
- **Canonical Transaction Ledger:** Searchable, categorized transaction feed with UPI VPA tags and merchant clean-names.
- **One-Tap Manual Entry:** Fast modal to record income and expenses with automatic optimistic balance adjustments.
- **Investment Portfolio:** Live tracking for Direct Equities, Mutual Funds (SIPs), Sovereign Gold Bonds (SGB), Bullion, and Crypto with P&L gains.
- **Instant Demo Mode:** One-tap demo exploration pre-populated with realistic Indian financial data.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Start Expo Development Server
```bash
npm start
```

### 3. Run on Devices

- **On Android:**
  - Install **Expo Go** from Google Play Store on your phone.
  - Scan the terminal QR code using the Expo Go app.
  - Or press `a` in the terminal to launch the Android Studio Emulator.

- **On iPhone (iOS):**
  - Install **Expo Go** from Apple App Store on your iPhone.
  - Scan the terminal QR code using your iPhone camera.
  - Or press `i` on your Mac to launch the iOS Simulator.

---

## 🛠️ Architecture

```text
mobile/
├── assets/                  # App icon, adaptive icon, splash screen
├── src/
│   ├── api/
│   │   ├── supabase.ts      # Supabase client with AsyncStorage session
│   │   └── financialService.ts # Live endpoints with demo fallback
│   ├── components/          # Reusable UI (Card, Badge, Button, CurrencyText, Header)
│   ├── context/
│   │   ├── AuthContext.tsx  # User session, login, signup, demo mode
│   │   ├── ThemeContext.tsx # Dynamic dark/light theme switcher
│   │   └── FinancialContext.tsx # Shared state for balances, txs & net worth
│   ├── navigation/
│   │   ├── AppNavigator.tsx # Auth vs Main Stack router
│   │   └── BottomTabNavigator.tsx # 5 bottom tabs with Lucide icons
│   ├── screens/
│   │   ├── auth/LoginScreen.tsx
│   │   ├── dashboard/DashboardScreen.tsx
│   │   ├── accounts/AccountsScreen.tsx
│   │   ├── transactions/TransactionsScreen.tsx
│   │   ├── investments/InvestmentsScreen.tsx
│   │   └── settings/SettingsScreen.tsx
│   ├── theme/               # Design tokens & color palettes
│   └── types/               # Strong TypeScript financial models
├── app.json
├── package.json
└── tsconfig.json
```

import { Platform, TextStyle } from 'react-native';

/** Cross-platform monospace font name (iOS uses Menlo instead of Android's monospace). */
export const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

/** Decimal keypad on iOS so numeric inputs include a decimal point cleanly. */
export const NUMERIC_KEYBOARD = Platform.OS === 'ios' ? ('decimal-pad' as const) : ('numeric' as const);

/** Tabular numerals prevent financial digits from shifting width horizontally on iOS. */
export const TABULAR_NUMS_STYLE: Pick<TextStyle, 'fontVariant'> = {
  fontVariant: ['tabular-nums'],
};

/** Expanded touch hitSlop to meet Apple HIG 44x44pt minimum tap targets on compact links/icons. */
export const COMPACT_HIT_SLOP = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

/** Bottom padding for the tab bar so labels clear the iPhone home indicator. */
export const getTabBarBottomPadding = (bottomInset: number): number => Math.max(bottomInset, 8);

/** Dynamic tab bar height factoring in the iPhone home-indicator safe area. */
export const getTabBarHeight = (bottomInset: number): number =>
  56 + getTabBarBottomPadding(bottomInset);

/** Bottom padding inside bottom-sheet modals to clear the iPhone home indicator. */
export const getSheetBottomPadding = (bottomInset: number): number => Math.max(bottomInset, 16) + 8;

/** ScrollView bottom clearance so content scrolls cleanly past the floating action hub and tab bar. */
export const getScrollBottomPadding = (bottomInset: number): number =>
  getTabBarHeight(bottomInset) + 88;

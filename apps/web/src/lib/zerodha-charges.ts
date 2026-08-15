import { getZerodhaRules } from "./broker-rules/zerodha";

export interface ZerodhaChargeBreakdown {
  brokerage: number;
  stt: number;
  transactionFee: number;
  gst: number;
  sebiCharges: number;
  stampDuty: number;
  dpCharges: number;
  totalCharges: number;
}

/**
 * 1. Equity Delivery (Stocks Delivery Buy/Sell)
 */
export function calculateEquityDeliveryCharges(
  turnover: number, 
  isBuy: boolean, 
  uniqueScripsSold: number = 1,
  dateOrVersion?: string | Date
): ZerodhaChargeBreakdown {
  if (turnover <= 0) {
    return { brokerage: 0, stt: 0, transactionFee: 0, gst: 0, sebiCharges: 0, stampDuty: 0, dpCharges: 0, totalCharges: 0 };
  }

  const rules = getZerodhaRules(dateOrVersion).equityDelivery;

  const brokerage = turnover * rules.brokeragePct;
  const stt = Math.round(turnover * rules.sttPct * 100) / 100;
  const transactionFee = Math.round(turnover * rules.nseTxnFeePct * 100) / 100;
  const sebiCharges = Math.round(turnover * rules.sebiChargesPct * 100) / 100;
  const stampDuty = isBuy ? Math.round(turnover * rules.stampDutyBuyPct * 100) / 100 : 0;
  
  // DP charges apply only on sell, per unique scrip
  const dpCharges = !isBuy ? uniqueScripsSold * rules.dpChargeMalePerScripDay : 0;
  
  const gst = Math.round((brokerage + transactionFee) * rules.gstPct * 100) / 100;

  const totalCharges = Math.round((brokerage + stt + transactionFee + gst + sebiCharges + stampDuty + dpCharges) * 100) / 100;

  return { brokerage, stt, transactionFee, gst, sebiCharges, stampDuty, dpCharges, totalCharges };
}

/**
 * 2. Equity Intraday (Stocks Intraday Buy/Sell)
 */
export function calculateEquityIntradayCharges(
  turnover: number, 
  isBuy: boolean,
  dateOrVersion?: string | Date
): ZerodhaChargeBreakdown {
  if (turnover <= 0) {
    return { brokerage: 0, stt: 0, transactionFee: 0, gst: 0, sebiCharges: 0, stampDuty: 0, dpCharges: 0, totalCharges: 0 };
  }

  const rules = getZerodhaRules(dateOrVersion).equityIntraday;

  const brokerage = Math.min(rules.brokerageMaxAbsolute, Math.round(turnover * rules.brokeragePct * 100) / 100);
  const stt = !isBuy ? Math.round(turnover * rules.sttSellPct * 100) / 100 : 0;
  const transactionFee = Math.round(turnover * rules.nseTxnFeePct * 100) / 100;
  const sebiCharges = Math.round(turnover * rules.sebiChargesPct * 100) / 100;
  const stampDuty = isBuy ? Math.round(turnover * rules.stampDutyBuyPct * 100) / 100 : 0;
  const gst = Math.round((brokerage + transactionFee) * rules.gstPct * 100) / 100;

  const totalCharges = Math.round((brokerage + stt + transactionFee + gst + sebiCharges + stampDuty) * 100) / 100;

  return { brokerage, stt, transactionFee, gst, sebiCharges, stampDuty, dpCharges: 0, totalCharges };
}

/**
 * 3. Direct Mutual Funds (Zerodha Coin)
 */
export function calculateMutualFundCharges(
  turnover: number, 
  isBuy: boolean,
  dateOrVersion?: string | Date
): ZerodhaChargeBreakdown {
  if (turnover <= 0) {
    return { brokerage: 0, stt: 0, transactionFee: 0, gst: 0, sebiCharges: 0, stampDuty: 0, dpCharges: 0, totalCharges: 0 };
  }

  const rules = getZerodhaRules(dateOrVersion).mutualFunds;

  const stampDuty = isBuy ? Math.round(turnover * rules.stampDutyBuyPct * 100) / 100 : 0;
  const stt = !isBuy ? Math.round(turnover * rules.sttSellPct * 100) / 100 : 0;

  const totalCharges = Math.round((stampDuty + stt) * 100) / 100;

  return { brokerage: 0, stt, transactionFee: 0, gst: 0, sebiCharges: 0, stampDuty, dpCharges: 0, totalCharges };
}

/**
 * 4. F&O Futures (Zerodha Kite Derivatives - Futures)
 */
export function calculateFnoFuturesCharges(
  turnover: number, 
  isBuy: boolean,
  dateOrVersion?: string | Date
): ZerodhaChargeBreakdown {
  if (turnover <= 0) {
    return { brokerage: 0, stt: 0, transactionFee: 0, gst: 0, sebiCharges: 0, stampDuty: 0, dpCharges: 0, totalCharges: 0 };
  }

  const rules = getZerodhaRules(dateOrVersion).fnoFutures;

  const brokerage = Math.min(rules.brokerageMaxAbsolute, Math.round(turnover * rules.brokeragePct * 100) / 100);
  const stt = !isBuy ? Math.round(turnover * rules.sttSellPct * 100) / 100 : 0;
  const transactionFee = Math.round(turnover * rules.nseTxnFeePct * 100) / 100;
  const sebiCharges = Math.round(turnover * rules.sebiChargesPct * 100) / 100;
  const stampDuty = isBuy ? Math.round(turnover * rules.stampDutyBuyPct * 100) / 100 : 0;
  const gst = Math.round((brokerage + transactionFee) * rules.gstPct * 100) / 100;

  const totalCharges = Math.round((brokerage + stt + transactionFee + gst + sebiCharges + stampDuty) * 100) / 100;

  return { brokerage, stt, transactionFee, gst, sebiCharges, stampDuty, dpCharges: 0, totalCharges };
}

/**
 * 5. F&O Options (Zerodha Kite Derivatives - Options)
 */
export function calculateFnoOptionsCharges(
  turnover: number, 
  isBuy: boolean,
  dateOrVersion?: string | Date
): ZerodhaChargeBreakdown {
  if (turnover <= 0) {
    return { brokerage: 0, stt: 0, transactionFee: 0, gst: 0, sebiCharges: 0, stampDuty: 0, dpCharges: 0, totalCharges: 0 };
  }

  const rules = getZerodhaRules(dateOrVersion).fnoOptions;

  const brokerage = rules.brokeragePerOrderAbsolute;
  const stt = !isBuy ? Math.round(turnover * rules.sttSellPct * 100) / 100 : 0;
  const transactionFee = Math.round(turnover * rules.nseTxnFeePct * 100) / 100;
  const sebiCharges = Math.round(turnover * rules.sebiChargesPct * 100) / 100;
  const stampDuty = isBuy ? Math.round(turnover * rules.stampDutyBuyPct * 100) / 100 : 0;
  const gst = Math.round((brokerage + transactionFee) * rules.gstPct * 100) / 100;

  const totalCharges = Math.round((brokerage + stt + transactionFee + gst + sebiCharges + stampDuty) * 100) / 100;

  return { brokerage, stt, transactionFee, gst, sebiCharges, stampDuty, dpCharges: 0, totalCharges };
}

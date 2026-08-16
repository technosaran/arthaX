export type BrokerRuleVersion = string;

export interface BrokerCharges {
  version: BrokerRuleVersion;
  equityDelivery: {
    brokeragePct: number;
    sttPct: number;
    nseTxnFeePct: number;
    gstPct: number;
    sebiChargesPct: number;
    stampDutyBuyPct: number;
    dpChargeMalePerScripDay: number;
    dpChargeFemalePerScripDay: number;
  };
  equityIntraday: {
    brokeragePct: number;
    brokerageMaxAbsolute: number;
    sttSellPct: number;
    nseTxnFeePct: number;
    sebiChargesPct: number;
    stampDutyBuyPct: number;
    gstPct: number;
  };
  mutualFunds: {
    brokeragePct: number;
    stampDutyBuyPct: number;
    sttSellPct: number;
  };
  fnoFutures: {
    brokeragePct: number;
    brokerageMaxAbsolute: number;
    sttSellPct: number;
    nseTxnFeePct: number;
    sebiChargesPct: number;
    stampDutyBuyPct: number;
    gstPct: number;
  };
  fnoOptions: {
    brokeragePerOrderAbsolute: number;
    sttSellPct: number;
    nseTxnFeePct: number;
    sebiChargesPct: number;
    stampDutyBuyPct: number;
    gstPct: number;
  };
}

export const ZERODHA_RULES: Record<string, BrokerCharges> = {
  "FY2025-26": {
    version: "FY2025-26",
    equityDelivery: {
      brokeragePct: 0,
      sttPct: 0.1 / 100,
      nseTxnFeePct: 0.00297 / 100, // Old rate
      gstPct: 18 / 100,
      sebiChargesPct: 0.0001 / 100,
      stampDutyBuyPct: 0.015 / 100,
      dpChargeMalePerScripDay: 15.93,
      dpChargeFemalePerScripDay: 15.93,
    },
    equityIntraday: {
      brokeragePct: 0.03 / 100,
      brokerageMaxAbsolute: 20,
      sttSellPct: 0.025 / 100,
      nseTxnFeePct: 0.00297 / 100, // Old rate
      sebiChargesPct: 0.0001 / 100,
      stampDutyBuyPct: 0.003 / 100,
      gstPct: 18 / 100,
    },
    mutualFunds: {
      brokeragePct: 0,
      stampDutyBuyPct: 0.005 / 100,
      sttSellPct: 0.001 / 100,
    },
    fnoFutures: {
      brokeragePct: 0.03 / 100,
      brokerageMaxAbsolute: 20,
      sttSellPct: 0.0125 / 100,
      nseTxnFeePct: 0.00173 / 100, // Old rate
      sebiChargesPct: 0.0001 / 100,
      stampDutyBuyPct: 0.002 / 100,
      gstPct: 18 / 100,
    },
    fnoOptions: {
      brokeragePerOrderAbsolute: 20,
      sttSellPct: 0.0625 / 100, // Old rate
      nseTxnFeePct: 0.0355 / 100, // Old rate
      sebiChargesPct: 0.0001 / 100,
      stampDutyBuyPct: 0.003 / 100,
      gstPct: 18 / 100,
    },
  },
  "FY2026-27": {
    version: "FY2026-27",
    equityDelivery: {
      brokeragePct: 0,
      sttPct: 0.1 / 100,
      nseTxnFeePct: 0.0030699 / 100, // New updated rate
      gstPct: 18 / 100,
      sebiChargesPct: 0.0001 / 100,
      stampDutyBuyPct: 0.015 / 100,
      dpChargeMalePerScripDay: 15.34, // Corrected to male logic
      dpChargeFemalePerScripDay: 15.05,
    },
    equityIntraday: {
      brokeragePct: 0.03 / 100,
      brokerageMaxAbsolute: 20,
      sttSellPct: 0.025 / 100,
      nseTxnFeePct: 0.0030699 / 100, // New updated rate
      sebiChargesPct: 0.0001 / 100,
      stampDutyBuyPct: 0.003 / 100,
      gstPct: 18 / 100,
    },
    mutualFunds: {
      brokeragePct: 0,
      stampDutyBuyPct: 0.005 / 100,
      sttSellPct: 0.001 / 100,
    },
    fnoFutures: {
      brokeragePct: 0.03 / 100,
      brokerageMaxAbsolute: 20,
      sttSellPct: 0.0125 / 100,
      nseTxnFeePct: 0.00173 / 100, // Unchanged in instructions but keeping isolated
      sebiChargesPct: 0.0001 / 100,
      stampDutyBuyPct: 0.002 / 100,
      gstPct: 18 / 100,
    },
    fnoOptions: {
      brokeragePerOrderAbsolute: 20,
      sttSellPct: 0.15 / 100, // Critical new rate update
      nseTxnFeePct: 0.03553 / 100, // New updated rate
      sebiChargesPct: 0.0001 / 100,
      stampDutyBuyPct: 0.003 / 100,
      gstPct: 18 / 100,
    },
  },
};

export function getZerodhaRules(dateOrVersion: string | Date = new Date()): BrokerCharges {
  if (typeof dateOrVersion === "string" && ZERODHA_RULES[dateOrVersion]) {
    return ZERODHA_RULES[dateOrVersion];
  }
  
  const d = typeof dateOrVersion === "string" ? new Date() : dateOrVersion;
  const year = d.getFullYear();
  const month = d.getMonth();
  const fyStartYear = month >= 3 ? year : year - 1;
  const versionStr = `FY${fyStartYear}-${(fyStartYear + 1).toString().slice(2)}`;
  
  if (ZERODHA_RULES[versionStr]) {
    return ZERODHA_RULES[versionStr];
  }
  
  const ruleKeys = Object.keys(ZERODHA_RULES).sort();
  if (ruleKeys.length === 0) throw new Error("No broker rules defined");
  
  return ZERODHA_RULES[ruleKeys[ruleKeys.length - 1]];
}

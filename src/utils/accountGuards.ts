export const DEFAULT_CASH_ID = "00000000-0000-0000-0000-000000000001";

export interface AccountGuardCandidate {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  last_four?: string | null;
}

/**
 * Returns true if the account represents the built-in Liquid Cash / Cash in Hand wallet.
 */
export function isCashAccount(acc: AccountGuardCandidate): boolean {
  const cleanName = (acc.name || "").trim().toLowerCase();
  const cleanType = (acc.type || "").trim().toLowerCase();
  const cleanLastFour = (acc.last_four || "").trim().toUpperCase();

  return (
    acc.id === DEFAULT_CASH_ID ||
    cleanType === "liquid cash" ||
    cleanType === "cash" ||
    cleanName === "cash in hand" ||
    cleanName === "cash wallet" ||
    cleanLastFour === "CASH"
  );
}

/**
 * Returns true if the account is an investment / demat / brokerage card.
 */
export function isDematAccount(acc: AccountGuardCandidate): boolean {
  const cleanName = (acc.name || "").trim().toLowerCase();
  const cleanType = (acc.type || "").trim().toLowerCase();

  return (
    cleanType.toUpperCase() === "INVESTMENT" ||
    cleanType.includes("demat") ||
    cleanType.includes("trading") ||
    cleanName.includes("zerodha") ||
    cleanName.includes("demat") ||
    cleanName.includes("trading")
  );
}

/**
 * Returns true if the account is the integrated Zerodha / Kite brokerage card.
 */
export function isZerodhaAccount(acc: AccountGuardCandidate): boolean {
  const cleanName = (acc.name || "").trim().toLowerCase();
  return cleanName.includes("zerodha") || cleanName.includes("kite");
}

/**
 * Returns a user-facing protection reason if the account cannot be deleted, or null if deletable.
 */
export function getProtectedAccountReason(acc: AccountGuardCandidate): string | null {
  if (isCashAccount(acc)) {
    return "Cash in Hand is a permanent built-in card and cannot be deleted.";
  }
  if (isZerodhaAccount(acc)) {
    return "Zerodha Trading & Demat is an integrated account and cannot be deleted here.";
  }
  return null;
}

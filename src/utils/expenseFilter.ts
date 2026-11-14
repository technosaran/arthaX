export interface TransactionLike {
  title?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  category?: string | null;
}

/**
 * Identifies if a transaction is a family support / allowance transfer.
 * Family transfers are managed exclusively within the Family section and
 * excluded from regular personal expenses and budgets.
 */
export function isFamilyTransfer(item: TransactionLike): boolean {
  if (!item) return false;

  // 1. Check tags array
  if (item.tags && Array.isArray(item.tags)) {
    if (item.tags.includes("family") || item.tags.includes("family_support")) {
      return true;
    }
  }

  // 2. Check title prefix or patterns
  const title = (item.title || "").toLowerCase().trim();
  if (title.startsWith("money sent to") || title.includes("money sent to")) {
    return true;
  }

  // 3. Check notes for family transfer indicators
  const notes = (item.notes || "").toLowerCase().trim();
  if (notes.includes("family support transfer") || notes.includes("family allowance")) {
    return true;
  }

  return false;
}

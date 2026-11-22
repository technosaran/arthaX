import { describe, it, expect } from "vitest";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastPayload {
  title: string;
  message?: string;
  type: ToastType;
}

// Emulate Toast resolution logic as implemented in ToastContext.tsx
function resolveToast(
  title: string,
  messageOrType?: string | ToastType,
  typeArg?: ToastType
): ToastPayload {
  const isToastType = (val: unknown): val is ToastType =>
    val === "success" || val === "error" || val === "info" || val === "warning";

  let resolvedType: ToastType = "success";
  let resolvedMessage: string | undefined = undefined;

  if (isToastType(messageOrType)) {
    resolvedType = messageOrType;
    resolvedMessage = undefined;
  } else {
    resolvedMessage = messageOrType;
    if (typeArg && isToastType(typeArg)) {
      resolvedType = typeArg;
    }
  }

  return {
    title,
    message: resolvedMessage,
    type: resolvedType,
  };
}

describe("Action Messages and Toast Resolution Suite", () => {
  it("resolves classic 3-argument toast calls with distinct title, message, and type", () => {
    const res = resolveToast(
      "Expense Recorded",
      "Swiggy Order (₹450) recorded successfully.",
      "success"
    );
    expect(res.title).toBe("Expense Recorded");
    expect(res.message).toBe("Swiggy Order (₹450) recorded successfully.");
    expect(res.type).toBe("success");
  });

  it("safely handles 2-argument calls where 2nd argument is a ToastType", () => {
    // Before this fix, calling showToast("Invalid amount", "error") set message="error" and type="success"
    const res = resolveToast("Please enter a goal title.", "error");
    expect(res.title).toBe("Please enter a goal title.");
    expect(res.message).toBeUndefined();
    expect(res.type).toBe("error");
  });

  it("safely handles warning toast type for input validations", () => {
    const res = resolveToast("Invalid Target Amount", "Please specify a target greater than ₹0.", "warning");
    expect(res.title).toBe("Invalid Target Amount");
    expect(res.message).toBe("Please specify a target greater than ₹0.");
    expect(res.type).toBe("warning");
  });

  it("calculates appropriate duration and styling properties per toast type", async () => {
    const { getToastDuration, getToastThemeConfig } = await import("@/context/ToastContext");
    expect(getToastDuration("error")).toBe(4800);
    expect(getToastDuration("warning")).toBe(4800);
    expect(getToastDuration("success")).toBe(3800);
    expect(getToastDuration("info")).toBe(3800);

    const successTheme = getToastThemeConfig("success");
    expect(successTheme.progressBar).toContain("emerald");
    expect(successTheme.glowColor).toContain("16, 185, 129");

    const errorTheme = getToastThemeConfig("error");
    expect(errorTheme.progressBar).toContain("rose");
    expect(errorTheme.glowColor).toContain("244, 63, 94");

    const warningTheme = getToastThemeConfig("warning");
    expect(warningTheme.progressBar).toContain("amber");

    const infoTheme = getToastThemeConfig("info");
    expect(infoTheme.progressBar).toContain("sky");
  });

  it("handles info toast type for informational and reverse actions", () => {
    const res = resolveToast("Transaction Reversed", '"Dinner with friends" deleted and balance restored.', "info");
    expect(res.title).toBe("Transaction Reversed");
    expect(res.message).toBe('"Dinner with friends" deleted and balance restored.');
    expect(res.type).toBe("info");
  });

  it("defaults to success when type is omitted in 2-argument call", () => {
    const res = resolveToast("Export Complete", "35 transactions downloaded to CSV.");
    expect(res.title).toBe("Export Complete");
    expect(res.message).toBe("35 transactions downloaded to CSV.");
    expect(res.type).toBe("success");
  });

  it("supports action messages for all core lifecycle workflows", () => {
    const actions = [
      { name: "Create Expense", toast: resolveToast("Expense Recorded", "₹500 for Groceries recorded.", "success") },
      { name: "Delete Expense", toast: resolveToast("Expense Deleted", '"Coffee" removed and balance restored.', "info") },
      { name: "Update Budget", toast: resolveToast("Budget Updated", "Dining limit set to ₹5,000.", "success") },
      { name: "Family Transfer", toast: resolveToast("Transfer Logged", "₹2,000 sent to Mom.", "success") },
      { name: "Goal Progress", toast: resolveToast("Milestone Reached! 🎉", "Emergency Fund reached 100%!", "success") },
      { name: "Theme Toggle", toast: resolveToast("Dark Theme Activated", "Switched to deep dark mode.", "info") },
      { name: "Zerodha Sync", toast: resolveToast("Zerodha Synced!", "Synced 12 stocks and wallet balance.", "success") },
    ];

    for (const a of actions) {
      expect(a.toast.title).toBeTruthy();
      expect(typeof a.toast.title).toBe("string");
      expect(["success", "error", "warning", "info"]).toContain(a.toast.type);
    }
  });
});

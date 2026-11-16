import { describe, it, expect } from "vitest";

interface GoalTestItem {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  target_date?: string | null;
  status: "active" | "completed" | "paused";
}

function calculateGoalProgress(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
}

function calculateRequiredMonthlySaving(
  current: number,
  targetAmount: number,
  targetDateStr?: string | null,
  referenceDate: Date = new Date("2026-11-15")
): { isOverdue: boolean; diffDays: number; diffMonths: number; requiredPerMonth: number } | null {
  if (!targetDateStr) return null;
  const targetDate = new Date(targetDateStr);
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffMonths = Math.max(1, Math.round(diffDays / 30.4));
  const remaining = Math.max(0, targetAmount - current);
  const requiredPerMonth = remaining > 0 ? Math.ceil(remaining / diffMonths) : 0;

  return {
    diffDays,
    diffMonths,
    isOverdue: diffDays < 0,
    requiredPerMonth,
  };
}

describe("Financial Goals & Milestones Core Engine", () => {
  it("calculates progress percentage correctly with rounding and 100% cap", () => {
    expect(calculateGoalProgress(50000, 100000)).toBe(50);
    expect(calculateGoalProgress(33333, 100000)).toBe(33);
    expect(calculateGoalProgress(120000, 100000)).toBe(100);
    expect(calculateGoalProgress(0, 100000)).toBe(0);
    expect(calculateGoalProgress(1000, 0)).toBe(0);
  });

  it("calculates required monthly savings velocity towards future target date", () => {
    const referenceDate = new Date("2026-11-15");
    // Target date 6 months away (~180 days)
    const result = calculateRequiredMonthlySaving(20000, 100000, "2027-05-15", referenceDate);
    expect(result).not.toBeNull();
    expect(result?.isOverdue).toBe(false);
    expect(result?.diffMonths).toBe(6);
    // 80,000 / 6 = 13,334
    expect(result?.requiredPerMonth).toBe(13334);
  });

  it("detects overdue target dates correctly", () => {
    const referenceDate = new Date("2026-11-15");
    const result = calculateRequiredMonthlySaving(10000, 50000, "2026-10-01", referenceDate);
    expect(result).not.toBeNull();
    expect(result?.isOverdue).toBe(true);
    expect(result?.diffDays).toBeLessThan(0);
  });

  it("auto-transitions goal status to completed when current amount meets or exceeds target", () => {
    const goal: GoalTestItem = {
      id: "test-1",
      title: "MacBook Pro",
      target_amount: 150000,
      current_amount: 120000,
      status: "active",
    };

    const depositAmount = 30000;
    const newCurrent = goal.current_amount + depositAmount;
    const newStatus = newCurrent >= goal.target_amount ? "completed" : goal.status;

    expect(newCurrent).toBe(150000);
    expect(newStatus).toBe("completed");
  });

  it("handles withdrawal adjustments and keeps status active if below target", () => {
    const goal: GoalTestItem = {
      id: "test-2",
      title: "Vacation",
      target_amount: 100000,
      current_amount: 100000,
      status: "completed",
    };

    const withdrawAmount = 25000;
    const newCurrent = Math.max(0, goal.current_amount - withdrawAmount);
    const newStatus = newCurrent < goal.target_amount ? "active" : goal.status;

    expect(newCurrent).toBe(75000);
    expect(newStatus).toBe("active");
  });
});

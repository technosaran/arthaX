/**
 * Month Stepper & Boundary Utilities
 * Ensures no navigation into future months and prevents going back to months where no data exists.
 */

export function getLocalDateString(date: Date = new Date(), timezone: string = "Asia/Kolkata"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}

export function getCurrentMonthYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function formatMonthDisplay(monthYear: string): string {
  if (!monthYear || !monthYear.includes("-")) {
    return formatMonthDisplay(getCurrentMonthYear());
  }
  const [yearStr, monthStr] = monthYear.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const date = new Date(year, month, 1);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function getEarliestDataMonth(
  dataDates: (string | null | undefined)[],
  currentMonthYear: string = getCurrentMonthYear()
): string {
  const validMonths = dataDates
    .map((d) => (d ? d.slice(0, 7) : null))
    .filter((m): m is string => Boolean(m && /^\d{4}-\d{2}$/.test(m)));

  if (validMonths.length === 0) {
    return currentMonthYear;
  }

  validMonths.sort();
  const earliest = validMonths[0];
  return earliest < currentMonthYear ? earliest : currentMonthYear;
}

export function computeNextMonth(monthYear: string, currentMonthYear: string = getCurrentMonthYear()): string {
  if (monthYear >= currentMonthYear) {
    return currentMonthYear;
  }
  const [yearStr, monthStr] = monthYear.split("-");
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1;
  month += 1;
  if (month > 11) {
    month = 0;
    year += 1;
  }
  const next = `${year}-${String(month + 1).padStart(2, "0")}`;
  return next <= currentMonthYear ? next : currentMonthYear;
}

export function computePrevMonth(monthYear: string, earliestMonthYear: string): string {
  if (monthYear <= earliestMonthYear) {
    return earliestMonthYear;
  }
  const [yearStr, monthStr] = monthYear.split("-");
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1;
  month -= 1;
  if (month < 0) {
    month = 11;
    year -= 1;
  }
  const prev = `${year}-${String(month + 1).padStart(2, "0")}`;
  return prev >= earliestMonthYear ? prev : earliestMonthYear;
}

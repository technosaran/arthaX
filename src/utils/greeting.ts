export type TimePeriod = "morning" | "afternoon" | "evening" | "night";

export interface TimeGreeting {
  text: string;
  emoji: string;
  period: TimePeriod;
}

/**
 * Returns a time-appropriate greeting and emoji based on the hour of the day.
 * - 05:00 - 11:59 -> Good morning ☀️
 * - 12:00 - 16:59 -> Good afternoon 🌤️
 * - 17:00 - 20:59 -> Good evening 🌆
 * - 21:00 - 04:59 -> Good evening 🌙
 */
export function getTimeGreeting(date: Date = new Date()): TimeGreeting {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return { text: "Good morning", emoji: "☀️", period: "morning" };
  }
  if (hour >= 12 && hour < 17) {
    return { text: "Good afternoon", emoji: "🌤️", period: "afternoon" };
  }
  if (hour >= 17 && hour < 21) {
    return { text: "Good evening", emoji: "🌆", period: "evening" };
  }
  return { text: "Good evening", emoji: "🌙", period: "night" };
}

/**
 * Formats greeting text with an optional user display name.
 */
export function formatGreeting(greeting: string, name?: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed || trimmed.toLowerCase() === "user") {
    return greeting;
  }
  return `${greeting}, ${trimmed}`;
}

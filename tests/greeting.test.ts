import { describe, it, expect } from "vitest";
import { getTimeGreeting, formatGreeting } from "../src/utils/greeting";

describe("getTimeGreeting", () => {
  it("returns Good morning with ☀️ between 05:00 and 11:59", () => {
    const earlyMorning = new Date("2026-11-13T05:00:00");
    const midMorning = new Date("2026-11-13T09:30:00");
    const lateMorning = new Date("2026-11-13T11:59:59");

    expect(getTimeGreeting(earlyMorning)).toEqual({
      text: "Good morning",
      emoji: "☀️",
      period: "morning",
    });
    expect(getTimeGreeting(midMorning)).toEqual({
      text: "Good morning",
      emoji: "☀️",
      period: "morning",
    });
    expect(getTimeGreeting(lateMorning)).toEqual({
      text: "Good morning",
      emoji: "☀️",
      period: "morning",
    });
  });

  it("returns Good afternoon with 🌤️ between 12:00 and 16:59", () => {
    const noon = new Date("2026-11-13T12:00:00");
    const midAfternoon = new Date("2026-11-13T14:45:00");
    const lateAfternoon = new Date("2026-11-13T16:59:59");

    expect(getTimeGreeting(noon)).toEqual({
      text: "Good afternoon",
      emoji: "🌤️",
      period: "afternoon",
    });
    expect(getTimeGreeting(midAfternoon)).toEqual({
      text: "Good afternoon",
      emoji: "🌤️",
      period: "afternoon",
    });
    expect(getTimeGreeting(lateAfternoon)).toEqual({
      text: "Good afternoon",
      emoji: "🌤️",
      period: "afternoon",
    });
  });

  it("returns Good evening with 🌆 between 17:00 and 20:59", () => {
    const eveningStart = new Date("2026-11-13T17:00:00");
    const dusk = new Date("2026-11-13T19:15:00");
    const lateEvening = new Date("2026-11-13T20:59:59");

    expect(getTimeGreeting(eveningStart)).toEqual({
      text: "Good evening",
      emoji: "🌆",
      period: "evening",
    });
    expect(getTimeGreeting(dusk)).toEqual({
      text: "Good evening",
      emoji: "🌆",
      period: "evening",
    });
    expect(getTimeGreeting(lateEvening)).toEqual({
      text: "Good evening",
      emoji: "🌆",
      period: "evening",
    });
  });

  it("returns Good evening with 🌙 between 21:00 and 04:59", () => {
    const nightStart = new Date("2026-11-13T21:00:00");
    const lateNight = new Date("2026-11-13T23:45:00");
    const midnight = new Date("2026-11-13T00:00:00");
    const earlyHours = new Date("2026-11-13T03:30:00");
    const preDawn = new Date("2026-11-13T04:59:59");

    expect(getTimeGreeting(nightStart)).toEqual({
      text: "Good evening",
      emoji: "🌙",
      period: "night",
    });
    expect(getTimeGreeting(lateNight)).toEqual({
      text: "Good evening",
      emoji: "🌙",
      period: "night",
    });
    expect(getTimeGreeting(midnight)).toEqual({
      text: "Good evening",
      emoji: "🌙",
      period: "night",
    });
    expect(getTimeGreeting(earlyHours)).toEqual({
      text: "Good evening",
      emoji: "🌙",
      period: "night",
    });
    expect(getTimeGreeting(preDawn)).toEqual({
      text: "Good evening",
      emoji: "🌙",
      period: "night",
    });
  });
});

describe("formatGreeting", () => {
  it("formats greeting with user name", () => {
    expect(formatGreeting("Good morning", "Saran")).toBe("Good morning, Saran");
    expect(formatGreeting("Good evening", "  Alex  ")).toBe("Good evening, Alex");
  });

  it("handles empty or generic user names cleanly", () => {
    expect(formatGreeting("Good evening", null)).toBe("Good evening");
    expect(formatGreeting("Good evening", undefined)).toBe("Good evening");
    expect(formatGreeting("Good evening", "")).toBe("Good evening");
    expect(formatGreeting("Good evening", "   ")).toBe("Good evening");
    expect(formatGreeting("Good evening", "User")).toBe("Good evening");
    expect(formatGreeting("Good evening", "user")).toBe("Good evening");
  });
});

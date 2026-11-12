"use client";

import React from "react";
import { Users, HeartHandshake, Home, ShieldCheck } from "lucide-react";

const FAMILY_HIGHLIGHTS = [
  {
    title: "Family Members",
    description: "Add and organize everyone included in your household finances.",
    icon: Users,
  },
  {
    title: "Shared Goals",
    description: "Track joint savings plans and milestones together.",
    icon: HeartHandshake,
  },
  {
    title: "Household Planning",
    description: "Group recurring home responsibilities and upcoming needs.",
    icon: Home,
  },
  {
    title: "Safety & Access",
    description: "Keep visibility aligned while protecting sensitive information.",
    icon: ShieldCheck,
  },
];

export default function FamilySection() {
  return (
    <section className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Family</h1>
          <p className="text-xs sm:text-sm mt-1 opacity-70">
            Set up your shared family space for household planning and collaboration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FAMILY_HIGHLIGHTS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-2xl border p-4 sm:p-5 transition-colors"
                style={{
                  borderColor: "var(--app-border)",
                  backgroundColor: "var(--app-card)",
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0"
                    style={{
                      borderColor: "var(--app-border-subtle)",
                      backgroundColor: "var(--app-accent-subtle)",
                    }}
                  >
                    <Icon size={16} style={{ color: "var(--app-accent)" }} />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold">{item.title}</h2>
                    <p className="text-xs mt-1 opacity-70 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

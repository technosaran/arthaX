import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Settings",
  description: "Configure your arthaX profile, connected brokerage APIs, security preferences, and workspace integrations.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SettingsPage() {
  redirect("/?tab=settings");
}

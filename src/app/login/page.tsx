import type { Metadata } from "next";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign In & Security Access",
  description:
    "Sign in to arthaX Sovereign Wealth & Portfolio Intelligence Platform. Securely access your equities, mutual funds, gold, bonds, and bank accounts.",
  alternates: {
    canonical: "/login",
  },
};

export default function LoginPage() {
  return <LoginClient />;
}

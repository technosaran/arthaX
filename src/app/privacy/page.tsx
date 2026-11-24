import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import { ShieldCheck, Lock, EyeOff, UserCheck, ArrowLeft, Mail } from "lucide-react";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy, zero-knowledge encryption, and personal data protection principles for arthaX.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between p-4 sm:p-8 lg:p-12 select-text"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      <div className="max-w-4xl mx-auto w-full space-y-8">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between pb-6 border-b border-[var(--app-border-subtle)]">
          <Link href="/" className="flex items-center gap-3 group focus:outline-none">
            <Logo size={36} showText={true} />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs font-semibold opacity-70 hover:opacity-100 hover:text-emerald-400 transition-colors"
            >
              Home
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-1.5 text-xs font-semibold opacity-70 hover:opacity-100 transition-opacity"
            >
              <ArrowLeft size={14} />
              <span>Back to Login</span>
            </Link>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
          <p className="text-xs font-mono opacity-60">Last updated: November 13, 2026</p>
        </div>

        {/* Core Principles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 space-y-2">
            <div className="p-2 w-fit rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-sm font-bold">100% Data Privacy</h3>
            <p className="text-xs opacity-70 leading-relaxed">
              Every financial record is encrypted and bounded by PostgreSQL Row-Level Security (RLS). Only your authenticated account can read or alter your data.
            </p>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="p-2 w-fit rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <EyeOff size={20} />
            </div>
            <h3 className="text-sm font-bold">Zero Data Selling</h3>
            <p className="text-xs opacity-70 leading-relaxed">
              We never sell, rent, monetize, or trade your personal or financial data to advertising brokers, marketers, or external entities.
            </p>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="p-2 w-fit rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Lock size={20} />
            </div>
            <h3 className="text-sm font-bold">Encrypted in Transit & Rest</h3>
            <p className="text-xs opacity-70 leading-relaxed">
              Data is transmitted via HTTPS/TLS 1.3 and stored in securely encrypted databases with strict access credentials.
            </p>
          </Card>
        </div>

        {/* Detailed Sections */}
        <Card className="p-6 sm:p-8 space-y-6 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold flex items-center gap-2">
              <UserCheck size={18} className="text-emerald-400" />
              1. Information We Collect
            </h2>
            <p className="opacity-80">
              <strong>arthaX</strong> collects only the minimal data strictly required to deliver personal finance tracking:
            </p>
            <ul className="list-disc pl-5 space-y-1 opacity-80 text-xs sm:text-sm">
              <li><strong>Account Credentials:</strong> Email address, full name, and encrypted authentication tokens.</li>
              <li><strong>Financial Ledger Entries:</strong> Account titles, categories, transaction records, amounts, budgets, and timestamps entered by you.</li>
              <li><strong>Google User Data:</strong> When signing in with Google OAuth, we receive your verified email address, full name, and avatar URL to create and identify your session. We do not access your Google Drive, Gmail messages, contacts, or any other Google service data.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">2. How We Use Google User Data &amp; Limited Use Disclosure</h2>
            <p className="opacity-80">
              Google OAuth authentication and API data is exclusively used to:
            </p>
            <ul className="list-disc pl-5 space-y-1 opacity-80 text-xs sm:text-sm">
              <li>Authenticate your identity securely without requiring a separate password.</li>
              <li>Personalize your profile display name and avatar in arthaX.</li>
              <li>Protect against unauthorized access through Google&apos;s multi-factor authentication infrastructure.</li>
              <li>
                <strong>Optional E-Statement Parsing (gmail.readonly):</strong> If you explicitly opt-in to connect Gmail synchronization in Settings, read-only access is used strictly on-demand to identify and extract financial transaction receipts (e.g. mutual fund CAS statements and broker contract notes) directly into your private ledger. arthaX does not read personal messages, compose, delete, or modify any emails.
              </li>
            </ul>

            <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 space-y-2 mt-3">
              <p className="text-xs sm:text-sm font-semibold text-sky-400">
                Google API Services User Data Policy Compliance
              </p>
              <p className="opacity-90 text-xs sm:text-sm leading-relaxed">
                arthaX&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 underline font-medium hover:text-emerald-300"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs opacity-75">
                <li>Google user data is never transferred to third parties or advertising brokers.</li>
                <li>Google user data is never used to serve targeted advertisements.</li>
                <li>Google user data is never used to train generalized artificial intelligence or machine learning models.</li>
                <li>Human access to user data is strictly prohibited unless explicitly authorized by the user for technical resolution.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">3. Data Storage & Security</h2>
            <p className="opacity-80">
              Your financial records are hosted on secure, SOC-2 compliant cloud infrastructure provided by Supabase and Vercel. Database access is strictly governed by PostgreSQL Row-Level Security (RLS) policies enforcing that only the user matching <code className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs">auth.uid()</code> has access to their own data rows.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">4. Data Ownership & Deletion Rights</h2>
            <p className="opacity-80">
              You retain full ownership of your data at all times. You may export your financial statements or request complete account and data deletion at any time by contacting us. Upon receiving a deletion request, all associated transactions, accounts, and profile data are permanently expunged.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Mail size={16} className="text-emerald-400" />
              5. Contact & Inquiries
            </h2>
            <p className="opacity-80">
              If you have any questions about this Privacy Policy or how your data is handled, please reach out to:
            </p>
            <p className="font-mono text-xs text-emerald-400">
              support@arthax.app
            </p>
          </section>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs opacity-50 pb-6">
          © 2026 arthaX. All rights reserved.
        </div>
      </div>
    </div>
  );
}

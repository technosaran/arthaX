import React from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { ShieldCheck, Lock, EyeOff, UserCheck, ArrowLeft, Mail } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata = {
  title: "Privacy Policy — arthaX",
  description: "Privacy policy and personal data protection principles for arthaX Personal Finance.",
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
          <div className="flex items-center gap-3">
            <Logo size={36} showText={true} />
            <Badge variant="emerald" dot>
              Privacy Policy
            </Badge>
          </div>
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-xs font-semibold opacity-70 hover:opacity-100 transition-opacity"
          >
            <ArrowLeft size={14} />
            <span>Back to Login</span>
          </Link>
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

          <section className="space-y-2">
            <h2 className="text-base font-bold">2. How We Use Google User Data</h2>
            <p className="opacity-80">
              Google OAuth authentication data is exclusively used to:
            </p>
            <ul className="list-disc pl-5 space-y-1 opacity-80 text-xs sm:text-sm">
              <li>Authenticate your identity securely without requiring a separate password.</li>
              <li>Personalize your profile display name in arthaX.</li>
              <li>Protect against unauthorized access through Google&apos;s multi-factor authentication infrastructure.</li>
            </ul>
            <p className="opacity-80 text-xs">
              arthaX complies with the Google API Services User Data Policy, including the Limited Use requirements.
            </p>
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
              iamsaran.ai@gmail.com
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

"use client";

import React from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import {
  ShieldCheck,
  Lock,
  EyeOff,
  TrendingUp,
  ArrowRight,
  Database,
  RefreshCw,
  PieChart,
  FileText,
  Mail,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function PublicLandingView() {
  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between selection:bg-emerald-500/20 selection:text-emerald-300"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* 1. Header & Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b border-[var(--app-border-subtle)] bg-[var(--app-bg)]/85 px-4 sm:px-8 py-3.5 transition-colors">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group focus:outline-none">
            <Logo size={36} showText={true} />
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium opacity-80">
            <a href="#features" className="hover:opacity-100 hover:text-emerald-400 transition-colors">
              Features
            </a>
            <a href="#transparency" className="hover:opacity-100 hover:text-emerald-400 transition-colors">
              Data Transparency
            </a>
            <a href="#security" className="hover:opacity-100 hover:text-emerald-400 transition-colors">
              Security
            </a>
            <Link href="/privacy" className="hover:opacity-100 hover:text-emerald-400 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:opacity-100 hover:text-emerald-400 transition-colors">
              Terms of Service
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="primary" size="sm" className="gap-1.5 shadow-sm">
                <span>Sign In</span>
                <ArrowRight size={14} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-8 py-12 sm:py-20 space-y-20">
        {/* Hero Section */}
        <section className="text-center space-y-6 max-w-3xl mx-auto pt-4 sm:pt-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-xs">
            <Sparkles size={13} />
            <span>Sovereign Wealth & Portfolio Intelligence</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15]">
            Institutional-Grade Multi-Asset Wealth Ledger
          </h1>

          <p className="text-sm sm:text-base md:text-lg opacity-75 leading-relaxed">
            <strong>arthaX</strong> empowers individuals and family offices with real-time portfolio tracking
            across Indian Equities, AMFI Mutual Funds, Fixed Income Bonds, Gold/Silver Bullion, and F&amp;O derivatives.
            Architected with zero-knowledge encryption and strict PostgreSQL Row-Level Security.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/login" className="w-full sm:w-auto">
              <Button variant="primary" size="lg" className="w-full sm:w-auto gap-2 text-sm font-semibold">
                <span>Access Your Portfolio</span>
                <ChevronRight size={16} />
              </Button>
            </Link>
            <a href="#transparency" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 text-sm">
                <ShieldCheck size={16} className="text-emerald-400" />
                <span>Google Data Transparency</span>
              </Button>
            </a>
          </div>

          {/* Trust Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-8 border-t border-[var(--app-border-subtle)] text-xs font-mono opacity-70">
            <div className="flex items-center justify-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>100% Free &amp; Sovereign</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>Zero-Knowledge Storage</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>Zero Data Selling</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>PostgreSQL RLS Security</span>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="space-y-8 scroll-mt-24">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Comprehensive App Functionality
            </h2>
            <p className="text-xs sm:text-sm opacity-70">
              Everything required to manage high-net-worth multi-asset portfolios in a unified ledger.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="p-6 space-y-3 card-hover-dynamic">
              <div className="p-2.5 w-fit rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp size={22} />
              </div>
              <h3 className="text-base font-bold">Multi-Asset Tracking</h3>
              <p className="text-xs sm:text-sm opacity-70 leading-relaxed">
                Seamless real-time valuation for Indian Equities (NSE/BSE), AMFI Mutual Funds, Fixed Income Sovereign Gold Bonds (SGB), Bullion, and F&amp;O positions.
              </p>
            </Card>

            <Card className="p-6 space-y-3 card-hover-dynamic">
              <div className="p-2.5 w-fit rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <RefreshCw size={22} />
              </div>
              <h3 className="text-base font-bold">Broker &amp; Exchange Auto-Sync</h3>
              <p className="text-xs sm:text-sm opacity-70 leading-relaxed">
                Connect your Zerodha Kite account for automated holdings synchronization, executed trade journals, and real-time P&amp;L intelligence.
              </p>
            </Card>

            <Card className="p-6 space-y-3 card-hover-dynamic">
              <div className="p-2.5 w-fit rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <PieChart size={22} />
              </div>
              <h3 className="text-base font-bold">Family Office Cashflow</h3>
              <p className="text-xs sm:text-sm opacity-70 leading-relaxed">
                Manage accounts across family members, tag transactions, monitor monthly budgets, track tax harvesting liabilities, and review unified balance sheets.
              </p>
            </Card>

            <Card className="p-6 space-y-3 card-hover-dynamic">
              <div className="p-2.5 w-fit rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <FileText size={22} />
              </div>
              <h3 className="text-base font-bold">Financial Statement Intelligence</h3>
              <p className="text-xs sm:text-sm opacity-70 leading-relaxed">
                Upload bank e-statements, broker contract notes, or mutual fund CAS statements with deterministic local parsing and category allocation.
              </p>
            </Card>

            <Card className="p-6 space-y-3 card-hover-dynamic">
              <div className="p-2.5 w-fit rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Lock size={22} />
              </div>
              <h3 className="text-base font-bold">PostgreSQL Row-Level Security</h3>
              <p className="text-xs sm:text-sm opacity-70 leading-relaxed">
                All records are strictly isolated at the database level with Supabase PostgreSQL RLS. Only your verified session can decrypt or access your records.
              </p>
            </Card>

            <Card className="p-6 space-y-3 card-hover-dynamic">
              <div className="p-2.5 w-fit rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <EyeOff size={22} />
              </div>
              <h3 className="text-base font-bold">Zero Data Monetization</h3>
              <p className="text-xs sm:text-sm opacity-70 leading-relaxed">
                We believe financial privacy is a fundamental human right. We do not display ads, sell data to brokers, or share records with third parties.
              </p>
            </Card>
          </div>
        </section>

        {/* Google Data Transparency & Limited Use Section */}
        <section id="transparency" className="space-y-6 scroll-mt-24">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <ShieldCheck size={14} />
              <span>Google API Compliance</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Google Data &amp; OAuth Transparency
            </h2>
            <p className="text-xs sm:text-sm opacity-70">
              How arthaX accesses, handles, and protects information requested through Google OAuth services.
            </p>
          </div>

          <Card className="p-6 sm:p-8 space-y-6 border-emerald-500/30 bg-emerald-500/[0.02]">
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Mail size={20} className="text-emerald-400" />
                <span>Purpose of Requested Google OAuth Scopes</span>
              </h3>
              <p className="text-xs sm:text-sm opacity-80 leading-relaxed">
                <strong>arthaX</strong> requests access only to the minimal necessary Google scopes required to deliver secure authentication and optional financial statement extraction:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] space-y-2">
                  <div className="flex items-center gap-2 font-mono text-xs text-emerald-400">
                    <CheckCircle2 size={16} />
                    <span>Basic Authentication (email, profile, openid)</span>
                  </div>
                  <p className="text-xs opacity-75 leading-relaxed">
                    Used exclusively to verify your identity, create your private workspace, and authenticate sessions securely without requiring or storing passwords on our servers.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)] space-y-2">
                  <div className="flex items-center gap-2 font-mono text-xs text-sky-400">
                    <CheckCircle2 size={16} />
                    <span>Optional Financial E-Statement Sync (gmail.readonly)</span>
                  </div>
                  <p className="text-xs opacity-75 leading-relaxed">
                    If you explicitly connect Gmail sync in Settings, read-only access is used strictly on-demand to identify financial transaction receipts (mutual fund CAS statements, broker notes). arthaX never reads personal messages, composes, or deletes emails.
                  </p>
                </div>
              </div>
            </div>

            {/* Canonical Limited Use Disclosure */}
            <div className="p-5 rounded-xl border border-sky-500/20 bg-sky-500/5 space-y-3">
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-sky-400">
                Google API Services User Data Policy — Limited Use Disclosure
              </h4>
              <p className="text-xs sm:text-sm font-medium leading-relaxed opacity-90">
                arthaX&apos;s use and transfer to any other app of information received from Google APIs will adhere to{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                >
                  <span>Google API Services User Data Policy</span>
                  <ExternalLink size={12} />
                </a>
                , including the Limited Use requirements.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs opacity-75">
                <li>Google user data is never used to serve advertisements.</li>
                <li>Google user data is never transferred to external third parties or data brokers.</li>
                <li>Google user data is never used for training generalized machine learning or AI models.</li>
                <li>Human access to user data is strictly prohibited, except with your explicit prior consent for technical support.</li>
              </ul>
            </div>

            {/* Quick Links */}
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-medium">
              <Link href="/privacy" className="text-emerald-400 hover:underline inline-flex items-center gap-1">
                <span>Read Full Privacy Policy</span>
                <ArrowRight size={13} />
              </Link>
              <span className="opacity-30">•</span>
              <Link href="/terms" className="text-emerald-400 hover:underline inline-flex items-center gap-1">
                <span>View Terms of Service</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </Card>
        </section>

        {/* Security & Data Ownership Section */}
        <section id="security" className="space-y-8 scroll-mt-24">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Sovereignty &amp; Data Deletion
            </h2>
            <p className="text-xs sm:text-sm opacity-70">
              You own 100% of your data at all times. Export or permanently delete your account with one click.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="p-6 space-y-2">
              <Database size={20} className="text-emerald-400" />
              <h3 className="text-sm font-bold">Complete Portability</h3>
              <p className="text-xs opacity-70 leading-relaxed">
                Export all historical transactions, holdings, and portfolio analytics to standard CSV and JSON formats anytime.
              </p>
            </Card>

            <Card className="p-6 space-y-2">
              <ShieldCheck size={20} className="text-sky-400" />
              <h3 className="text-sm font-bold">Right to Erasure</h3>
              <p className="text-xs opacity-70 leading-relaxed">
                Permanently purge your account, database entries, and OAuth credentials with zero lingering backups upon request.
              </p>
            </Card>

            <Card className="p-6 space-y-2">
              <Lock size={20} className="text-purple-400" />
              <h3 className="text-sm font-bold">Zero Third-Party Trackers</h3>
              <p className="text-xs opacity-70 leading-relaxed">
                No third-party tracking scripts, marketing pixels, or invasive session recorders are deployed on arthaX.
              </p>
            </Card>
          </div>
        </section>

        {/* Call to Action */}
        <section className="text-center p-8 sm:p-12 rounded-3xl border border-[var(--app-border)] bg-[var(--app-card-elevated)] space-y-5 shadow-lg">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Ready to Take Control of Your Wealth?
          </h2>
          <p className="text-xs sm:text-sm opacity-75 max-w-lg mx-auto leading-relaxed">
            Join arthaX today. Free forever for personal use, completely open, and private by design.
          </p>
          <div className="pt-2">
            <Link href="/login">
              <Button variant="primary" size="lg" className="gap-2 font-semibold shadow-md">
                <span>Get Started Now</span>
                <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* 3. Footer */}
      <footer className="border-t border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]/50 px-4 sm:px-8 py-10 transition-colors">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs opacity-75">
          <div className="flex items-center gap-3">
            <Logo size={28} showText={true} />
            <span className="opacity-40">|</span>
            <span>© 2026 arthaX. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/privacy" className="hover:opacity-100 hover:text-emerald-400 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:opacity-100 hover:text-emerald-400 transition-colors">
              Terms of Service
            </Link>
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-100 hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
            >
              <span>Google API User Data Policy</span>
              <ExternalLink size={11} />
            </a>
            <a
              href="mailto:support@arthax.app"
              className="hover:opacity-100 hover:text-emerald-400 transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

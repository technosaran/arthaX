import React from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Terms of Service — arthaX",
  description: "Terms of service and acceptable usage guidelines for arthaX Personal Finance.",
};

export default function TermsPage() {
  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between p-4 sm:p-8 lg:p-12 select-text"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      <div className="max-w-4xl mx-auto w-full space-y-8">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between pb-6 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
          <div className="flex items-center gap-3">
            <Logo size={36} showText={true} />
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Terms of Service
            </span>
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
          <h1 className="text-3xl font-extrabold tracking-tight">Terms of Service</h1>
          <p className="text-xs font-mono opacity-60">Last updated: November 13, 2026</p>
        </div>

        {/* Detailed Content */}
        <div
          className="p-6 sm:p-8 rounded-3xl border space-y-6 text-sm leading-relaxed"
          style={{ backgroundColor: "var(--app-card)", borderColor: "var(--app-border)" }}
        >
          <section className="space-y-2">
            <h2 className="text-base font-bold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              1. Agreement to Terms
            </h2>
            <p className="opacity-80">
              By accessing or using arthaX (&ldquo;the Application&rdquo;), you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you must discontinue use of the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">2. Personal Use & Financial Information</h2>
            <p className="opacity-80">
              arthaX provides self-directed personal wealth tracking, cashflow management, and budgeting tools for informational and personal record-keeping purposes only. arthaX does not provide investment advice, brokerage services, or financial consulting.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">3. Account Security</h2>
            <p className="opacity-80">
              You are responsible for maintaining the confidentiality of your credentials and OAuth authentication sessions. You agree to notify us immediately of any unauthorized access to your account.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">4. Intellectual Property & Brand</h2>
            <p className="opacity-80">
              The arthaX name, trademarks, logos, and user interface designs are the intellectual property of the operator. All rights not expressly granted are reserved.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">5. Contact Information</h2>
            <p className="opacity-80">
              For any questions regarding these Terms, please contact us at:
            </p>
            <p className="font-mono text-xs text-emerald-400">
              iamsaran.ai@gmail.com
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="text-center text-xs opacity-50 pb-6">
          © 2026 arthaX. All rights reserved.
        </div>
      </div>
    </div>
  );
}

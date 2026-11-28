import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Compass, Home, LogIn, Mail, ShieldCheck } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/PublicChrome";
import { siteConfig } from "@/config/seo";

export const metadata: Metadata = {
  title: "Page Not Found",
  description:
    "The page you requested could not be found on arthaX. Return to the home dashboard, sign in, or contact support.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--app-bg)] text-[var(--app-fg)]">
      <PublicHeader currentPath="/404" />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-8 py-16 sm:py-24">
        <div className="max-w-xl w-full text-center space-y-6 rounded-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-6 sm:p-10 shadow-sm">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
            <Compass size={14} />
            <span>404 — Route Not Found</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              This ledger page doesn&apos;t exist
            </h1>
            <p className="text-sm sm:text-base opacity-70 leading-relaxed">
              The URL you visited may have been moved, renamed, or mistyped. Jump back to your workspace or one of the pages below.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-sm px-5 py-3 shadow-sm transition-colors"
            >
              <Home size={16} />
              <span>Return to Home</span>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-subtle)] hover:border-emerald-500/40 font-medium text-sm px-5 py-3 transition-colors"
            >
              <LogIn size={16} />
              <span>Sign In</span>
            </Link>
          </div>

          <div className="pt-4 border-t border-[var(--app-border-subtle)] flex flex-wrap items-center justify-center gap-4 text-xs opacity-75">
            <Link href="/privacy" className="inline-flex items-center gap-1 hover:text-emerald-400 transition-colors">
              <ShieldCheck size={13} />
              <span>Privacy Policy</span>
            </Link>
            <Link href="/terms" className="inline-flex items-center gap-1 hover:text-emerald-400 transition-colors">
              <ArrowLeft size={13} />
              <span>Terms of Service</span>
            </Link>
            <a
              href={`mailto:${siteConfig.links.supportEmail}`}
              className="inline-flex items-center gap-1 hover:text-emerald-400 transition-colors"
            >
              <Mail size={13} />
              <span>{siteConfig.links.supportEmail}</span>
            </a>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

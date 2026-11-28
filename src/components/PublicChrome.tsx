"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Mail, Menu, X } from "lucide-react";
import Logo from "@/components/Logo";
import { siteConfig } from "@/config/seo";

const DEFAULT_NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#transparency", label: "How It Works" },
  { href: "/#security", label: "Security & Sync" },
];

interface PublicHeaderProps {
  currentPath?: "/" | "/privacy" | "/terms" | "/login" | "/404";
  showSignIn?: boolean;
}

export function PublicHeader({
  currentPath = "/",
  showSignIn = true,
}: PublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md border-b border-[var(--app-border-subtle)] bg-[var(--app-bg)]/90 px-4 sm:px-8 py-3.5 transition-colors">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <Link
          href="/"
          onClick={closeMenu}
          className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl shrink-0"
          aria-label="arthaX Home"
        >
          <Logo size={36} showText={true} />
        </Link>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-xs font-medium opacity-80"
        >
          {DEFAULT_NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:opacity-100 hover:text-emerald-400 transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/privacy"
            className={`transition-colors ${
              currentPath === "/privacy"
                ? "opacity-100 text-emerald-400 font-semibold"
                : "hover:opacity-100 hover:text-emerald-400"
            }`}
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className={`transition-colors ${
              currentPath === "/terms"
                ? "opacity-100 text-emerald-400 font-semibold"
                : "hover:opacity-100 hover:text-emerald-400"
            }`}
          >
            Terms
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {showSignIn && (
            <Link
              href="/login"
              onClick={closeMenu}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs sm:text-sm px-3.5 py-2 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <span>Sign In</span>
              <ArrowRight size={14} />
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] text-[var(--app-fg)] hover:border-emerald-500/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-expanded={mobileMenuOpen}
            aria-controls="public-mobile-menu"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav
          id="public-mobile-menu"
          aria-label="Mobile navigation"
          className="md:hidden max-w-6xl mx-auto mt-3 pt-3 pb-2 border-t border-[var(--app-border-subtle)] flex flex-col gap-1 text-sm"
        >
          {DEFAULT_NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              className="px-3 py-2.5 rounded-xl hover:bg-[var(--app-card)] font-medium transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/privacy"
            onClick={closeMenu}
            className={`px-3 py-2.5 rounded-xl hover:bg-[var(--app-card)] font-medium transition-colors ${
              currentPath === "/privacy" ? "text-emerald-400 bg-[var(--app-card)]" : ""
            }`}
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            onClick={closeMenu}
            className={`px-3 py-2.5 rounded-xl hover:bg-[var(--app-card)] font-medium transition-colors ${
              currentPath === "/terms" ? "text-emerald-400 bg-[var(--app-card)]" : ""
            }`}
          >
            Terms of Service
          </Link>
          <a
            href={`mailto:${siteConfig.links.supportEmail}`}
            onClick={closeMenu}
            className="px-3 py-2.5 rounded-xl hover:bg-[var(--app-card)] font-medium transition-colors inline-flex items-center gap-2 text-emerald-400"
          >
            <Mail size={15} />
            <span>{siteConfig.links.supportEmail}</span>
          </a>
        </nav>
      )}
    </header>
  );
}

export function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--app-border-subtle)] bg-[var(--app-card-subtle)]/50 px-4 sm:px-8 py-10 transition-colors">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs opacity-80">
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-center md:text-left">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="arthaX Home"
          >
            <Logo size={28} showText={true} />
          </Link>
          <span className="opacity-40 hidden sm:inline">|</span>
          <span>© {currentYear} {siteConfig.name}. All rights reserved.</span>
        </div>

        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5"
        >
          <Link href="/privacy" className="hover:opacity-100 hover:text-emerald-400 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:opacity-100 hover:text-emerald-400 transition-colors">
            Terms of Service
          </Link>
          <Link href="/login" className="hover:opacity-100 hover:text-emerald-400 transition-colors">
            Sign In
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
            href={`mailto:${siteConfig.links.supportEmail}`}
            className="hover:opacity-100 hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
          >
            <Mail size={11} />
            <span>{siteConfig.links.supportEmail}</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}

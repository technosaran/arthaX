"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/Logo";
import {
  Loader2,
  Mail,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  TrendingUp,
  ArrowRight,
  KeyRound,
  Sparkles,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-redirect if user already has an active session
  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  // Clean error translation for user-friendly UX
  const formatAuthError = (msg: string) => {
    const lower = msg.toLowerCase();
    if (lower.includes("invalid login credentials")) {
      return "Incorrect email or password. Please verify your credentials and try again.";
    }
    if (lower.includes("user already registered") || lower.includes("already registered")) {
      return "An account with this email already exists. Please switch to Sign In.";
    }
    if (lower.includes("password should be at least 6 characters")) {
      return "Your password must be at least 6 characters long.";
    }
    if (lower.includes("email not confirmed")) {
      return "Your account was created. Please sign in with your email and password.";
    }
    if (lower.includes("unable to validate email address") || lower.includes("invalid email")) {
      return "Please enter a valid email address.";
    }
    return msg;
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const supabase = createClient();
    const cleanEmail = email.trim().toLowerCase();

    // 1. FORGOT PASSWORD MODE
    if (mode === "forgot") {
      if (!cleanEmail) {
        setErrorMessage("Please enter your registered email address.");
        return;
      }
      setLoading(true);
      try {
        const origin = window.location.origin;
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${origin}/auth/callback?next=/settings`,
        });
        if (error) {
          setErrorMessage(formatAuthError(error.message));
        } else {
          setSuccessMessage(
            "Password reset instructions have been dispatched to your email address."
          );
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to initiate password reset."
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    // 2. SIGN UP MODE
    if (mode === "signup") {
      if (!fullName.trim()) {
        setErrorMessage("Please enter your full name.");
        return;
      }
      if (password.length < 6) {
        setErrorMessage("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match. Please re-enter.");
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });

        if (error) {
          setErrorMessage(formatAuthError(error.message));
          setLoading(false);
          return;
        }

        if (data.session) {
          setSuccessMessage("Account created successfully! Securing your private vault...");
          setTimeout(() => {
            window.location.href = "/";
          }, 400);
        } else {
          // Automatic sign in attempt with credentials
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

          if (signInError) {
            setSuccessMessage(
              "Account registered successfully! Please sign in with your credentials."
            );
            setMode("signin");
            setLoading(false);
          } else {
            setSuccessMessage("Welcome to arthaX! Loading your personal vault...");
            setTimeout(() => {
              window.location.href = "/";
            }, 400);
          }
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : "An unexpected error occurred during signup."
        );
        setLoading(false);
      }
      return;
    }

    // 3. SIGN IN MODE
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setErrorMessage(formatAuthError(error.message));
        setLoading(false);
      } else {
        setSuccessMessage("Identity verified. Navigating to personal dashboard...");
        setTimeout(() => {
          window.location.href = "/";
        }, 300);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred during login."
      );
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=/`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        setErrorMessage(formatAuthError(error.message));
        setLoading(false);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to initiate Google authentication."
      );
      setLoading(false);
    }
  };

  // If already authenticated and loading redirect
  if (authLoading) {
    return (
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center p-4 space-y-4"
        style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
      >
        <Logo size={48} showText={false} />
        <div className="flex items-center gap-2.5 text-xs font-mono text-zinc-400">
          <Loader2 size={16} className="animate-spin text-emerald-400" />
          <span>Verifying vault credentials...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden p-4 sm:p-6 lg:p-10 select-none"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-fg)" }}
    >
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none translate-y-1/2" />

      {/* Main Dual-Panel Container */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
        
        {/* Left Column: Institutional Brand & Security Showcase (Hidden on small screens) */}
        <div className="hidden lg:flex lg:col-span-6 flex-col justify-between space-y-8 pr-4">
          <div className="space-y-6">
            {/* Header Brand */}
            <div className="flex items-center gap-3">
              <Logo size={42} showText={true} />
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Multi-Tenant Vault
              </span>
            </div>

            {/* Headline */}
            <div className="space-y-3">
              <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight">
                Institutional Financial Telemetry & Autonomous Ledger
              </h1>
              <p className="text-sm opacity-70 leading-relaxed font-normal">
                Manage accounts, track liquidity, automate double-entry bookkeeping, and monitor cashflow with cryptographic row-level data isolation.
              </p>
            </div>

            {/* Core Architectural Pillars */}
            <div className="space-y-3 pt-2">
              <div
                className="flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all"
                style={{
                  backgroundColor: "var(--app-card)",
                  borderColor: "var(--app-border)",
                }}
              >
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0 mt-0.5">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h2 className="text-xs font-bold">100% Private Data Isolation</h2>
                  <p className="text-[11px] opacity-70 leading-relaxed mt-0.5">
                    Kernel-enforced PostgreSQL Row-Level Security (RLS). Every account, transaction, and budget is cryptographically locked to your user identity.
                  </p>
                </div>
              </div>

              <div
                className="flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all"
                style={{
                  backgroundColor: "var(--app-card)",
                  borderColor: "var(--app-border)",
                }}
              >
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex-shrink-0 mt-0.5">
                  <Zap size={18} />
                </div>
                <div>
                  <h2 className="text-xs font-bold">Edge-Accelerated Telemetry</h2>
                  <p className="text-[11px] opacity-70 leading-relaxed mt-0.5">
                    Sub-millisecond query execution powered by Upstash Redis cache-aside pipelines and real-time Supabase replication.
                  </p>
                </div>
              </div>

              <div
                className="flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all"
                style={{
                  backgroundColor: "var(--app-card)",
                  borderColor: "var(--app-border)",
                }}
              >
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex-shrink-0 mt-0.5">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h2 className="text-xs font-bold">Autonomous Ledger & Blueprints</h2>
                  <p className="text-[11px] opacity-70 leading-relaxed mt-0.5">
                    Real-time net worth synthesis, multi-account transfers, category budgeting, and reversible audit trails.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Live Status Indicator */}
          <div className="flex items-center justify-between text-[11px] font-mono opacity-60 pt-4 border-t" style={{ borderColor: "var(--app-border-subtle)" }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>RLS Engine: ACTIVE & ENFORCED</span>
            </div>
            <span>v2.4.0 Institutional Edition</span>
          </div>
        </div>

        {/* Right Column: Authentication Card */}
        <div className="w-full lg:col-span-6 flex justify-center">
          <div
            className="w-full max-w-md border rounded-3xl p-7 sm:p-9 shadow-2xl backdrop-blur-2xl space-y-6 transition-all"
            style={{
              backgroundColor: "var(--app-card)",
              borderColor: "var(--app-border)",
            }}
          >
            {/* Mobile Header Brand (Shown on small screens only) */}
            <div className="flex lg:hidden flex-col items-center text-center space-y-2 pb-2">
              <Logo size={42} showText={true} />
              <p className="text-xs opacity-70 max-w-xs font-medium">
                Institutional Financial Telemetry & Autonomous Ledger
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            {mode !== "forgot" ? (
              <div
                className="grid grid-cols-2 p-1 rounded-2xl border text-xs font-semibold"
                style={{
                  backgroundColor: "var(--app-bg)",
                  borderColor: "var(--app-border-subtle)",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`py-2.5 rounded-xl transition-all cursor-pointer font-bold ${
                    mode === "signin"
                      ? "shadow-sm"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  style={
                    mode === "signin"
                      ? {
                          backgroundColor: "var(--app-card)",
                          color: "var(--app-fg)",
                          border: "1px solid var(--app-border)",
                        }
                      : undefined
                  }
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`py-2.5 rounded-xl transition-all cursor-pointer font-bold ${
                    mode === "signup"
                      ? "shadow-sm"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  style={
                    mode === "signup"
                      ? {
                          backgroundColor: "var(--app-card)",
                          color: "var(--app-fg)",
                          border: "1px solid var(--app-border)",
                        }
                      : undefined
                  }
                >
                  Create Account
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between pb-1 border-b" style={{ borderColor: "var(--app-border-subtle)" }}>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <KeyRound size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Password Recovery</h3>
                    <p className="text-[11px] opacity-70">Enter your email to receive recovery instructions</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div className="flex items-start gap-2.5 p-3.5 text-xs border border-rose-500/30 rounded-2xl bg-rose-950/20 text-rose-400 animate-in fade-in">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-relaxed font-medium">{errorMessage}</span>
              </div>
            )}

            {/* Success Banner */}
            {successMessage && (
              <div className="flex items-start gap-2.5 p-3.5 text-xs border border-emerald-500/30 rounded-2xl bg-emerald-950/20 text-emerald-400 animate-in fade-in">
                <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5 text-emerald-400" />
                <span className="leading-relaxed font-medium">{successMessage}</span>
              </div>
            )}

            {/* Authentication Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {/* Full Name Field (Sign Up Only) */}
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold flex items-center gap-1.5 opacity-80">
                    <User size={13} className="text-emerald-400" />
                    <span>Full Name</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Saran Kumar"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all font-medium"
                      style={{
                        backgroundColor: "var(--app-bg)",
                        borderColor: "var(--app-border)",
                        color: "var(--app-fg)",
                      }}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center gap-1.5 opacity-80">
                  <Mail size={13} className="text-emerald-400" />
                  <span>Email Address</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all font-medium"
                    style={{
                      backgroundColor: "var(--app-bg)",
                      borderColor: "var(--app-border)",
                      color: "var(--app-fg)",
                    }}
                    required
                  />
                </div>
              </div>

              {/* Password Field (Sign In & Sign Up) */}
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold flex items-center gap-1.5 opacity-80">
                      <Lock size={13} className="text-emerald-400" />
                      <span>Password</span>
                    </label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode("forgot");
                          setErrorMessage(null);
                          setSuccessMessage(null);
                        }}
                        className="text-[11px] font-semibold text-emerald-400 hover:underline cursor-pointer opacity-80 hover:opacity-100"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all font-medium font-mono"
                      style={{
                        backgroundColor: "var(--app-bg)",
                        borderColor: "var(--app-border)",
                        color: "var(--app-fg)",
                      }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Password Field (Sign Up Only) */}
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold flex items-center gap-1.5 opacity-80">
                    <Lock size={13} className="text-emerald-400" />
                    <span>Confirm Password</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all font-medium font-mono"
                      style={{
                        backgroundColor: "var(--app-bg)",
                        borderColor: "var(--app-border)",
                        color: "var(--app-fg)",
                      }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Password validation cues */}
                  {password.length > 0 && (
                    <div className="flex items-center gap-2 pt-1 text-[11px] font-mono">
                      <span
                        className={`inline-flex items-center gap-1 ${
                          password.length >= 6 ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {password.length >= 6 ? "✓" : "○"} 6+ characters
                      </span>
                      {confirmPassword.length > 0 && (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            password === confirmPassword
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {password === confirmPassword ? "✓ match" : "✕ mismatch"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 mt-2 flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
                style={{
                  backgroundColor: "var(--app-accent)",
                  color: "#05070a",
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Processing vault request...</span>
                  </>
                ) : mode === "signin" ? (
                  <>
                    <span>Sign In to Vault</span>
                    <ArrowRight size={14} />
                  </>
                ) : mode === "signup" ? (
                  <>
                    <span>Create Personal Vault</span>
                    <Sparkles size={14} />
                  </>
                ) : (
                  <>
                    <span>Send Recovery Instructions</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            {/* Social Authentication Divider */}
            {mode !== "forgot" && (
              <div className="space-y-4">
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div
                      className="w-full border-t"
                      style={{ borderColor: "var(--app-border-subtle)" }}
                    />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-widest">
                    <span
                      className="px-3 opacity-60"
                      style={{ backgroundColor: "var(--app-card)" }}
                    >
                      or continue with
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-2.5 px-4 flex items-center justify-center gap-2.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer hover:bg-white/5 active:scale-[0.98] disabled:opacity-50 shadow-sm"
                  style={{
                    borderColor: "var(--app-border-subtle)",
                    backgroundColor: "var(--app-bg)",
                    color: "var(--app-fg)",
                  }}
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </div>
            )}

            {/* Mode Switcher Alternative Footer Link */}
            <div className="pt-2 text-center text-xs opacity-70">
              {mode === "signin" ? (
                <p>
                  Don&apos;t have a personal account yet?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="font-bold text-emerald-400 hover:underline cursor-pointer"
                  >
                    Create one now
                  </button>
                </p>
              ) : mode === "signup" ? (
                <p>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="font-bold text-emerald-400 hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="font-bold text-emerald-400 hover:underline cursor-pointer"
                >
                  Return to Sign In
                </button>
              )}
            </div>

            {/* Privacy & Tenant Isolation Assurance */}
            <div
              className="pt-4 border-t flex items-center justify-center gap-2 text-[11px] opacity-50 text-center"
              style={{ borderColor: "var(--app-border-subtle)" }}
            >
              <ShieldCheck size={14} className="text-emerald-400 flex-shrink-0" />
              <span>Isolated Vault • End-to-End Encrypted Sessions</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
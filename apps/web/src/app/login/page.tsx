"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { login } from "./actions";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import "./login.css";

const containerVariants: any = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 }
  }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 30 } }
};

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Real-Time Asset Synchronization",
    desc: "Seamless live tracking for stocks, mutual funds & forex portfolios."
  },
  {
    icon: (
      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Bank-Grade Encryption",
    desc: "Isolated session tokens, zero-knowledge storage & automated audit trails."
  },
  {
    icon: (
      <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: "AI Financial Intelligence",
    desc: "Automated cashflow analytics, anomaly detection & smart budget alerts."
  }
];

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) {
      setTimeout(() => {
        setError(decodeURIComponent(urlError));
      }, 0);
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  async function handleGoogleLogin() {
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message || "Failed to sign in with Google.");
        setLoading(false);
      } else if (data?.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("An unexpected error occurred during Google sign-in.");
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setLoading(true);
    
    try {
      const formData = new FormData(e.currentTarget);
      const result = await login(formData);
        
      if (result?.error) {
        setError(result.error);
        setLoading(false);
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper relative min-h-screen w-full flex flex-col lg:flex-row bg-[#030712] font-sans selection:bg-sky-500/30 overflow-x-hidden">
      
      {/* Background Noise Texture */}
      <div 
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.025] mix-blend-overlay" 
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
      />

      {/* Left Pane - Premium Branding & Highlights */}
      <div className="relative hidden lg:flex flex-col w-1/2 min-h-screen justify-between p-10 lg:p-14 border-r border-white/10 bg-[#030712]">
        
        {/* Dynamic Glowing Orbs */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-1/4 w-[700px] h-[700px] bg-sky-500/10 rounded-full blur-[130px] mix-blend-screen animate-blob" />
          <div className="absolute top-1/2 -right-1/4 w-[550px] h-[550px] bg-emerald-500/10 rounded-full blur-[110px] mix-blend-screen animate-blob animation-delay-2000" />
          <div className="absolute -bottom-1/4 left-1/3 w-[650px] h-[650px] bg-indigo-500/10 rounded-full blur-[130px] mix-blend-screen animate-blob animation-delay-4000" />
          
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)] opacity-20" />
        </div>

        {/* Brand Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/logo.png" 
              alt="arthaX Logo" 
              className="w-14 h-14 rounded-2xl object-cover shadow-[0_0_30px_rgba(56,189,248,0.4)] border border-sky-400/30" 
            />
            <h1 className="text-[clamp(2.4rem,4vw,3.2rem)] font-[950] text-white tracking-tight leading-none">
              artha<span className="text-sky-400">X</span>
            </h1>
          </div>
          <p className="text-base font-medium text-slate-300/80 max-w-lg leading-relaxed">
            Enterprise Wealth Terminal. Unify your assets, optimize your portfolio, and track financial performance in real-time.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="relative z-10 my-8 space-y-4 max-w-lg">
          {FEATURES.map((item, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + idx * 0.1, duration: 0.4 }}
              className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300 group"
            >
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 group-hover:scale-110 transition-transform">
                {item.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide mb-0.5">{item.title}</h3>
                <p className="text-xs text-slate-400 font-normal leading-relaxed">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer System Status Badge */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </div>
            <span className="text-[0.7rem] font-semibold text-slate-300 tracking-wider uppercase">Systems Operational & Secure</span>
          </div>
        </div>
      </div>

      {/* Right Pane - Authentication Form */}
      <div className="relative flex flex-col items-center justify-center w-full lg:w-1/2 min-h-screen p-4 sm:p-6 lg:p-12 overflow-y-auto">
        
        {/* Mobile Background Glows */}
        <div className="absolute inset-0 z-0 lg:hidden overflow-hidden pointer-events-none">
          <div className="absolute top-0 -left-1/4 w-[400px] h-[400px] bg-sky-500/10 rounded-full blur-[90px] mix-blend-screen animate-blob" />
          <div className="absolute bottom-0 -right-1/4 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[90px] mix-blend-screen animate-blob animation-delay-2000" />
        </div>

        {/* The Glass Card Container */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="relative z-10 w-full max-w-[420px] bg-[#0b0f19]/80 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
        >
          {/* Mobile Logo Header */}
          <motion.div variants={itemVariants} className="flex lg:hidden flex-col items-center text-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/logo.png" 
              alt="arthaX Logo" 
              className="w-13 h-13 rounded-2xl object-cover shadow-[0_0_25px_rgba(56,189,248,0.5)] border border-sky-400/40 mb-2" 
            />
            <h1 className="text-2xl font-[950] text-white tracking-tight">
              artha<span className="text-sky-400">X</span>
            </h1>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-white mb-1.5 tracking-tight">
              Sign In to Terminal
            </h2>
            <p className="text-slate-400 text-xs font-medium">
              Authenticate to access your private wealth terminal.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px] font-semibold">
              🔒 Private Authorized Instance
            </div>
          </motion.div>

          <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {/* Email Input Field with Icon */}
              <motion.div variants={itemVariants} layout key="email-field" className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="peer w-full bg-white/[0.03] border border-white/10 text-white text-sm rounded-xl pl-12 pr-4 pt-5 pb-2 outline-none focus:border-sky-500/50 focus:bg-white/[0.05] focus:shadow-[0_0_20px_rgba(14,165,233,0.15)] transition-all placeholder-transparent"
                  placeholder="you@example.com"
                />
                <label 
                  htmlFor="login-email"
                  className="absolute left-12 top-2 text-[0.6rem] font-bold text-slate-400 transition-all duration-200 pointer-events-none uppercase tracking-wider peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:font-medium peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:text-[0.6rem] peer-focus:font-bold peer-focus:text-sky-400"
                >
                  Email Address
                </label>
              </motion.div>

              {/* Password Input Field with Icon */}
              <motion.div variants={itemVariants} layout key="password-field" className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="peer w-full bg-white/[0.03] border border-white/10 text-white text-sm rounded-xl pl-12 pr-12 pt-5 pb-2 outline-none focus:border-sky-500/50 focus:bg-white/[0.05] focus:shadow-[0_0_20px_rgba(14,165,233,0.15)] transition-all placeholder-transparent"
                  placeholder="••••••••"
                />
                <label 
                  htmlFor="login-password"
                  className="absolute left-12 top-2 text-[0.6rem] font-bold text-slate-400 transition-all duration-200 pointer-events-none uppercase tracking-wider peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:font-medium peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:text-[0.6rem] peer-focus:font-bold peer-focus:text-sky-400"
                >
                  Password
                </label>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12c1.274-4.057 5.064-7 9.542-7 4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </motion.div>
            </AnimatePresence>

            {/* Error / Success Feedback Banners */}
            <AnimatePresence>
              {error ? (
                <motion.div 
                  key="error-message"
                  initial={{ opacity: 0, height: 0, scale: 0.95 }}
                  animate={{ opacity: 1, height: "auto", scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.95 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-2.5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-medium">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4M12 16h.01" />
                    </svg>
                    <span>{error}</span>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Primary Action Button */}
            <motion.button
              variants={itemVariants}
              layout
              type="submit"
              disabled={loading}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="relative w-full h-12 mt-2 rounded-xl text-white text-sm font-bold tracking-wide overflow-hidden transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              <div className="absolute inset-0 transition-colors duration-300 bg-sky-500 hover:bg-sky-400 shadow-[0_0_25px_rgba(14,165,233,0.3)]" />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)] -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              
              <div className="relative flex items-center justify-center gap-2 h-full">
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Authenticating...
                  </>
                ) : (
                  <>
                    <span>Access Terminal</span>
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </div>
            </motion.button>
          </form>

          {/* Separator */}
          <motion.div variants={itemVariants} className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/10" />
            <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-[0.2em]">Or continue with</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/10" />
          </motion.div>

          {/* Google Single Sign-On Button */}
          <motion.button
            variants={itemVariants}
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-xl text-white text-xs font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm"
          >
            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Google</span>
          </motion.button>

          {/* Footer Legal Links */}
          <motion.div variants={itemVariants} className="mt-6 pt-4 border-t border-white/5 flex justify-center">
            <div className="flex items-center gap-3 text-[0.7rem] font-medium text-slate-500">
              <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
              <span>•</span>
              <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
              <span>•</span>
              <a href="https://www.logo.dev" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">Logos by Logo.dev</a>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

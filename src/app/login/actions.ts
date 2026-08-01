"use server";

import { createClient } from "@/lib/supabase-server";
import { redisGet, redisIncr, redisExpire, redisSet } from "@/lib/redis";

const MAX_LOGIN_ATTEMPTS = 10;
const LOCKOUT_DURATION = 60 * 15; // 15 minutes

async function checkBruteForce(email: string): Promise<{ locked: boolean; remaining?: number; message?: string }> {
  const key = `bruteforce:login:${email.toLowerCase()}`;
  const attemptsStr = await redisGet(key);
  const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;

  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    return { locked: true, message: `Account temporarily locked due to too many failed attempts. Please try again in 15 minutes.` };
  }
  return { locked: false, remaining: MAX_LOGIN_ATTEMPTS - attempts - 1 };
}

async function recordFailedAttempt(email: string) {
  const key = `bruteforce:login:${email.toLowerCase()}`;
  const attempts = await redisIncr(key);
  if (attempts === 1) {
    await redisExpire(key, LOCKOUT_DURATION);
  }
}

async function clearFailedAttempts(email: string) {
  const key = `bruteforce:login:${email.toLowerCase()}`;
  await redisSet(key, "0", 1);
}

function validatePasswordPolicy(password: string): string | null {
  if (password.length < 6) return "Password must be at least 6 characters long.";
  return null;
}

async function verifyTurnstileToken(token: string | undefined): Promise<{ success: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET;
  
  // If no secret or no token, allow Supabase Auth to handle CAPTCHA validation
  if (!secret || !token) {
    return { success: true };
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        secret,
        response: token,
      }),
    });

    if (!response.ok) {
      console.error(`Turnstile siteverify HTTP error: ${response.status}`);
      return { success: true }; // Fallback to Supabase Auth handling
    }

    const result = await response.json();
    if (!result.success) {
      console.warn("Turnstile siteverify failed:", result["error-codes"]);
      return { success: false, error: "CAPTCHA verification failed. Please try again." };
    }

    return { success: true };
  } catch (err) {
    console.error("Turnstile siteverify exception:", err);
    return { success: true };
  }
}

export type AuthResult = {
  success?: boolean;
  error?: string;
  requiresVerification?: boolean;
  message?: string;
};

export async function login(formData: FormData): Promise<AuthResult> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || typeof email !== "string" || !email.trim()) {
    return { error: "Email is required." };
  }

  if (!password || typeof password !== "string" || !password.trim()) {
    return { error: "Password is required." };
  }

  const emailStr = email.trim();
  try {
    const bruteCheck = await checkBruteForce(emailStr);
    if (bruteCheck.locked) {
      return { error: bruteCheck.message };
    }
  } catch (err) {
    console.warn("Brute force check skipped:", err);
  }

  const captchaToken = formData.get("captchaToken");
  const captchaTokenStr = typeof captchaToken === "string" && captchaToken.trim() ? captchaToken.trim() : undefined;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: emailStr,
    password,
    options: captchaTokenStr ? { captchaToken: captchaTokenStr } : undefined,
  });

  if (error) {
    try {
      await recordFailedAttempt(emailStr);
    } catch {}
    console.error("Login error:", error);
    return { error: error.message || "Invalid email or password." };
  }

  try {
    await clearFailedAttempts(emailStr);
  } catch {}

  return { success: true };
}

export async function signup(formData: FormData): Promise<AuthResult> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || typeof email !== "string" || !email.trim()) {
    return { error: "Email is required." };
  }

  if (!password || typeof password !== "string" || !password.trim()) {
    return { error: "Password is required." };
  }
  
  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    return { error: policyError };
  }

  const captchaToken = formData.get("captchaToken");
  const captchaTokenStr = typeof captchaToken === "string" && captchaToken.trim() ? captchaToken.trim() : undefined;

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: captchaTokenStr ? { captchaToken: captchaTokenStr } : undefined,
  });

  if (error) {
    console.error("Signup error:", error);
    return { error: error.message || "Failed to create account." };
  }

  // If Supabase created user but email confirmation is required (no session yet)
  if (data.user && !data.session) {
    return {
      success: true,
      requiresVerification: true,
      message: "Account created successfully! If email verification is enabled, please check your inbox or try signing in."
    };
  }

  return { success: true };
}

"use server";

import { createClient } from "@/lib/supabase-server";
import { redisGet, redisIncr, redisExpire, redisSet } from "@/lib/redis";
import logger from "@/lib/logger";

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
    logger.warn("Brute force check skipped", { err: err instanceof Error ? err.message : String(err) });
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: emailStr,
    password,
  });

  if (error) {
    try {
      await recordFailedAttempt(emailStr);
    } catch (e) {
      logger.warn("Failed to record login attempt", { err: e instanceof Error ? e.message : String(e) });
    }
    logger.error("Login error", { err: error instanceof Error ? error : new Error(String(error)) });
    return { error: error.message || "Invalid email or password." };
  }

  try {
    await clearFailedAttempts(emailStr);
  } catch (e) {
    logger.warn("Failed to clear login attempts", { err: e instanceof Error ? e.message : String(e) });
  }

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

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });

  if (error) {
    logger.error("Signup error", { err: error instanceof Error ? error : new Error(String(error)) });
    return { error: error.message || "Failed to sign up." };
  }

  return { success: true };
}

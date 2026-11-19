/**
 * User Profile & Avatar Resolution Utilities
 * Handles Google OAuth, Gmail identities, profile pictures, and fallback names.
 */

export interface ResolvableUser {
  email?: string | null;
  user_metadata?: Record<string, any> | null;
  app_metadata?: Record<string, any> | null;
  identities?: Array<{ provider?: string; identity_data?: Record<string, any> }> | null;
}

/**
 * Checks whether the user authenticated via Google OAuth / Gmail SSO.
 */
export function isGoogleAccount(user?: ResolvableUser | null): boolean {
  if (!user) return false;
  return Boolean(
    user.app_metadata?.provider === "google" ||
      user.app_metadata?.providers?.includes("google") ||
      user.identities?.some((i) => i.provider === "google") ||
      user.user_metadata?.iss === "https://accounts.google.com" ||
      user.user_metadata?.avatar_url?.includes("googleusercontent.com")
  );
}

/**
 * Resolves the user's authentic display name, avoiding generic placeholder 'User'
 * and prioritizing verified Google metadata or custom profile names.
 */
export function resolveDisplayName(
  profileName?: string | null,
  userMetadata?: Record<string, any> | null,
  email?: string | null
): string {
  const rawProfileName = profileName?.trim();
  const validProfileName =
    rawProfileName && rawProfileName.toLowerCase() !== "user" ? rawProfileName : null;

  return (
    validProfileName ||
    userMetadata?.full_name ||
    userMetadata?.name ||
    (rawProfileName || "") ||
    email?.split("@")[0] ||
    "User"
  );
}

/**
 * Resolves the authentic avatar URL for Google / Gmail accounts,
 * with Unavatar fallback for standard email accounts.
 */
export function resolveAvatarUrl(user?: ResolvableUser | null): string | null {
  if (!user) return null;
  const isGoogle = isGoogleAccount(user);

  return (
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    user.identities?.find((i) => i.provider === "google")?.identity_data?.avatar_url ||
    user.identities?.find((i) => i.provider === "google")?.identity_data?.picture ||
    (user.email && !isGoogle
      ? `https://unavatar.io/${encodeURIComponent(user.email)}?fallback=false`
      : null) ||
    null
  );
}

/**
 * Computes 2-letter uppercase initials for profile avatars.
 */
export function computeInitials(displayName: string): string {
  if (!displayName) return "U";
  const trimmed = displayName.trim();
  if (!trimmed) return "U";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return trimmed.substring(0, 2).toUpperCase();
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Canonical display name for a person.
 * Use everywhere a profile is rendered so we never show inconsistent fallbacks
 * like "Unknown", "—", "?", "User", or "Member".
 *
 * Order: full_name → email local-part → contextual fallback ("Former member").
 */
export function displayName(
  profile: { full_name?: string | null; cal_poly_email?: string | null } | null | undefined,
  fallback: string = "Former member",
): string {
  const name = profile?.full_name?.trim();
  if (name) return name;
  const email = profile?.cal_poly_email?.trim();
  if (email) return email.split("@")[0];
  return fallback;
}

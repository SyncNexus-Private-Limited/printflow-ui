import type { AvatarSource } from "@/lib/customers/types";

/**
 * Resolve a customer avatar value to a displayable URL.
 *
 * - `external`: the value is already a full URL — returned as-is.
 * - `uploaded`: the value is a relative storage path/key. It is joined with
 *   `NEXT_PUBLIC_STORAGE_BASE_URL`. If that variable is not set, returns null
 *   and logs a warning (graceful degradation — component falls back to
 *   initials).
 *
 * @param avatar  Raw avatar value from the DB (URL or relative path), or null.
 * @param source  How the value should be interpreted. Defaults to "external".
 */
export function resolveAvatarUrl(
  avatar: string | null | undefined,
  source: AvatarSource = "external",
): string | null {
  if (!avatar) return null;

  if (source === "external") {
    return avatar;
  }

  // uploaded — requires NEXT_PUBLIC_STORAGE_BASE_URL at build/runtime.
  const base = process.env.NEXT_PUBLIC_STORAGE_BASE_URL;
  if (!base) {
    console.warn(
      "[resolveAvatarUrl] NEXT_PUBLIC_STORAGE_BASE_URL is not set. " +
        "Uploaded avatar cannot be resolved.",
    );
    return null;
  }

  return `${base.replace(/\/$/, "")}/${avatar}`;
}

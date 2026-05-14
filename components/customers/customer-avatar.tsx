"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Deterministic hue derived from the customer's name so the same customer
 * always gets the same colour across renders, even without a real avatar.
 */
function getInitialsHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? "").toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

type CustomerAvatarProps = {
  name: string;
  /**
   * Pre-resolved avatar URL (pass the output of `resolveAvatarUrl()`).
   * If null or undefined the component renders coloured initials instead.
   */
  avatarUrl?: string | null;
  /** Tailwind size class applied to the outer container. Defaults to "h-8 w-8". */
  sizeClass?: string;
  /** Extra classes forwarded to the outer container. */
  className?: string;
};

/**
 * Circular avatar: shows the customer's avatar image when available, otherwise
 * renders coloured initials derived deterministically from their name.
 *
 * Always pass a pre-resolved URL via `avatarUrl`; use `resolveAvatarUrl()` to
 * convert raw DB values before passing them here.
 */
export function CustomerAvatar({
  name,
  avatarUrl,
  sizeClass = "h-8 w-8",
  className,
}: CustomerAvatarProps) {
  // Track whether the image failed to load so we can fall back to initials.
  const [imgError, setImgError] = useState(false);

  // Reset error state whenever the URL changes (e.g. user edits the field).
  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const showImage = !!avatarUrl && !imgError;
  const hue = getInitialsHue(name);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        sizeClass,
        className,
      )}
      // Background is always rendered; the image overlays it when present.
      // This ensures initials have the correct colour even after an image error.
      style={{ background: `hsl(${hue} 55% 70%)` }}
    >
      {showImage ? (
        // Plain <img> — not next/image — so any external URL is accepted
        // without requiring remotePatterns configuration. Avatar URLs are
        // user-supplied and may come from any domain.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          className="absolute inset-0 h-full w-full rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : null}
      {/* Initials sit beneath the image; visible whenever image is absent/failed. */}
      <span
        aria-hidden="true"
        className="text-[0.6em] leading-none font-semibold select-none"
        style={{ color: `hsl(${hue} 40% 25%)` }}
      >
        {getInitials(name)}
      </span>
    </span>
  );
}

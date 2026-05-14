import { z } from "zod";

// ---------------------------------------------------------------------------
// Entity code (branches, expense categories, etc.)
// ---------------------------------------------------------------------------

/** Accepted characters for entity codes: uppercase letters, digits, hyphens. */
const ENTITY_CODE_RE = /^[A-Z0-9-]+$/;

/**
 * Entity code: 4–25 uppercase characters (uppercase letters, digits, hyphens).
 * Input is trimmed and uppercased before validation.
 * Examples: MAIN, HQ-01, NORTH25
 */
export const entityCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(4, "Code must be at least 4 characters")
  .max(25, "Code must be 25 characters or less")
  .refine(
    (v) => ENTITY_CODE_RE.test(v),
    "Code may only contain uppercase letters, numbers, and hyphens",
  );

/**
 * Optional entity code — same format as {@link entityCodeSchema} but the field
 * may be left blank.  Blank strings are treated as absent (undefined → null).
 * When a value is present it is trimmed, uppercased, and validated.
 */
export const optionalEntityCodeSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed.toUpperCase();
  },
  z
    .string()
    .min(4, "Code must be at least 4 characters")
    .max(25, "Code must be 25 characters or less")
    .refine(
      (v) => ENTITY_CODE_RE.test(v),
      "Code may only contain uppercase letters, numbers, and hyphens",
    )
    .optional(),
);

// ---------------------------------------------------------------------------
// Generic entity name
// ---------------------------------------------------------------------------

/**
 * Generic entity name: 2–120 characters, trimmed.
 * Suitable for branch names, category names, and similar short labels.
 */
export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(120, "Name must be 120 characters or less");

// ---------------------------------------------------------------------------
// Optional URL (logo, banner, etc.)
// ---------------------------------------------------------------------------

/** Matches a trimmed http or https URL with a non-empty path component. */
const HTTPS_URL_RE = /^https?:\/\/[^\s]{2,}$/;

/**
 * Optional http/https URL, max 500 characters.
 * Blank strings are treated as absent (undefined → saved as null).
 */
export const optionalUrlSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z
    .string()
    .max(500, "URL must be 500 characters or less")
    .refine((v) => HTTPS_URL_RE.test(v), "Enter a valid http or https URL")
    .optional(),
);

// ---------------------------------------------------------------------------
// Optional text (description, remarks, notes, etc.)
// ---------------------------------------------------------------------------

/**
 * Factory for optional trimmed text fields.
 * Blank strings are treated as absent (undefined → saved as null).
 * Use this for description, remarks, notes, and similar free-text fields.
 */
export function makeOptionalTextSchema(maxLength: number) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().max(maxLength, `Must be ${maxLength} characters or less`).optional(),
  );
}

/**
 * Strip all non-digit characters from a phone input and normalise leading
 * country-code / trunk prefixes so the result is a bare 10-digit string
 * ready for Indian mobile-number validation:
 *
 *   +91 98765 43210  →  9876543210
 *   009198765 43210  →  9876543210   (strip 0091 or 91 from 12-digit)
 *   09876543210      →  9876543210   (strip leading trunk 0 from 11-digit)
 *   9876543210       →  9876543210   (unchanged)
 */
export function normalizePhone(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/** 10-digit Indian mobile number: must start with 6, 7, 8, or 9. */
const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;

/** Usernames that are globally reserved and may not be registered. */
const RESERVED_USERNAMES = new Set([
  "admin",
  "root",
  "system",
  "superuser",
  "support",
  "help",
  "api",
  "www",
  "mail",
  "info",
  "contact",
  "noreply",
  "no-reply",
  "test",
  "demo",
  "guest",
  "user",
  "null",
  "undefined",
]);

// ---------------------------------------------------------------------------
// Full name
// ---------------------------------------------------------------------------

/**
 * Full name: 2–120 characters, letters/spaces/apostrophes/hyphens/dots only.
 */
export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Full name must be at least 2 characters")
  .max(120, "Full name must be 120 characters or less")
  .refine(
    (v) => /^[a-zA-Z\s'.-]+$/.test(v),
    "Full name may only contain letters, spaces, apostrophes, hyphens, and dots",
  );

// ---------------------------------------------------------------------------
// Phone numbers
// ---------------------------------------------------------------------------

/**
 * Required Indian mobile number.
 * Accepts common formats (+91 XXXXX XXXXX, 0XXXXXXXXXX, XXXXXXXXXX) and
 * normalises to a 10-digit string starting with 6–9 before validation.
 */
export const indianPhoneSchema = z.preprocess(
  normalizePhone,
  z
    .string()
    .min(1, "Phone number is required")
    .refine(
      (v) => INDIAN_PHONE_RE.test(v),
      "Enter a valid 10-digit Indian mobile number (must start with 6, 7, 8, or 9)",
    ),
);

/**
 * Optional alternate phone — same rules as {@link indianPhoneSchema}.
 * Blank / empty / null values are treated as absent (`undefined`).
 */
export const alternatePhoneSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "string" && value.trim() === "") return undefined;
    return normalizePhone(value);
  },
  z
    .string()
    .refine(
      (v) => INDIAN_PHONE_RE.test(v),
      "Enter a valid 10-digit Indian mobile number (must start with 6, 7, 8, or 9)",
    )
    .optional(),
);

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/**
 * Optional email address, max 254 characters (RFC 5321 limit).
 * Blank strings are treated as absent.
 */
export const emailSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().email("Enter a valid email address").max(254, "Email must be 254 characters or less").optional());

// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------

/**
 * Optional address, max 250 characters.
 * Blank strings are treated as absent.
 */
export const addressSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().max(250, "Address must be 250 characters or less").optional());

// ---------------------------------------------------------------------------
// Username
// ---------------------------------------------------------------------------

/**
 * Username: 4–30 characters, all lowercase letters / digits / underscores /
 * hyphens / dots. Must start with a letter and end with a letter or digit.
 * Reserved names are rejected.
 *
 * Input is lowercased before validation so mixed-case typing still works.
 */
const USERNAME_RE = /^[a-z][a-z0-9._-]*[a-z0-9]$/;

export const usernameSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z
    .string()
    .min(4, "Username must be at least 4 characters")
    .max(30, "Username must be 30 characters or less")
    .refine(
      (v) => USERNAME_RE.test(v),
      "Username must start with a letter, end with a letter or digit, and contain only lowercase letters, numbers, underscores, hyphens, and dots",
    )
    .refine(
      (v) => !RESERVED_USERNAMES.has(v),
      "This username is reserved — please choose a different one",
    ),
);

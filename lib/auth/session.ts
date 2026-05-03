import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { NextResponse } from "next/server";
import { z } from "zod";

const sessionPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.string().min(1),
  branchId: z.string().nullable(),
  username: z.string().min(1),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "dlms_session";

export function getSessionMaxAge() {
  const value = Number.parseInt(process.env.SESSION_MAX_AGE ?? "604800", 10);

  return Number.isFinite(value) && value > 0 ? value : 604800;
}

export function getActiveUserWindowMinutes() {
  const value = Number.parseInt(process.env.ACTIVE_USER_WINDOW_MINUTES ?? "15", 10);

  return Number.isFinite(value) && value > 0 ? value : 15;
}

export function getSessionTouchIntervalSeconds() {
  const value = Number.parseInt(process.env.SESSION_TOUCH_INTERVAL_SECONDS ?? "60", 10);

  return Number.isFinite(value) && value > 0 ? value : 60;
}

function getSessionSecret() {
  const secret = process.env.APP_SECRET;

  if (!secret) {
    throw new Error("APP_SECRET is not configured");
  }

  // HS256 requires a key of at least 256 bits (32 bytes) to be cryptographically sound.
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error(
      "APP_SECRET must be at least 32 bytes. Generate one with: openssl rand -base64 32",
    );
  }

  return new TextEncoder().encode(secret);
}

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionMaxAge(),
  };
}

export function getSessionExpiresAt() {
  return new Date(Date.now() + getSessionMaxAge() * 1000);
}

async function signSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(getSessionExpiresAt().getTime() / 1000))
    .sign(getSessionSecret());
}

export async function createSession(response: NextResponse, payload: SessionPayload) {
  const token = await signSessionToken(payload);
  const expiresAt = getSessionExpiresAt();

  response.cookies.set(SESSION_COOKIE_NAME, token, getCookieOptions());

  return {
    token,
    expiresAt,
  };
}

export async function verifySession(token: string | undefined) {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    return sessionPayloadSchema.parse(payload);
  } catch {
    return null;
  }
}

export function clearSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...getCookieOptions(),
    maxAge: 0,
  });
}

export async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const bytes = Array.from(new Uint8Array(digest));

  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { NextResponse } from "next/server";
import { z } from "zod";

const sessionPayloadSchema = z.object({
  userId: z.string().min(1),
  role: z.string().nullable(),
  branchId: z.string().nullable(),
  username: z.string().min(1),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "dlms_session";

function getSessionSecret() {
  const secret = process.env.APP_SECRET;

  if (!secret) {
    throw new Error("APP_SECRET is not configured");
  }

  return new TextEncoder().encode(secret);
}

function getSessionMaxAge() {
  const value = Number.parseInt(process.env.SESSION_MAX_AGE ?? "604800", 10);

  return Number.isFinite(value) && value > 0 ? value : 604800;
}

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionMaxAge(),
  };
}

export async function createSession(response: NextResponse, payload: SessionPayload) {
  const expiresAt = Math.floor(Date.now() / 1000) + getSessionMaxAge();
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSessionSecret());

  response.cookies.set(SESSION_COOKIE_NAME, token, getCookieOptions());
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

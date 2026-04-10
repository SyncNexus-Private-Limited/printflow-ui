import { NextResponse } from "next/server";
import { revokeCurrentSession } from "@/lib/auth/current-user";
import { clearSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  await revokeCurrentSession();

  const response = NextResponse.json({
    success: true,
    message: "Signed out successfully.",
  });

  clearSession(response);

  return response;
}

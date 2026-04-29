import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 302 });
  clearSession(response);
  return response;
}

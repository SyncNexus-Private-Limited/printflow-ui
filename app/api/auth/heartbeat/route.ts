import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";

export const runtime = "nodejs";

export async function POST() {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Session refreshed.",
  });
}


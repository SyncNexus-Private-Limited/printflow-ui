import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/postgres";
import { createSession, hashSessionToken } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validations/auth";
// UNCOMMENT WHEN MIGRATING: import { getClientIp, loginRateLimiter } from "@/lib/rate-limiting";

export const runtime = "nodejs";

type UserRow = {
  id: string;
  username: string;
  role: string;
  branchId: string | null;
  isActive: boolean;
};

function getValidationErrorResponse(fieldErrors: Record<string, string>) {
  const message =
    fieldErrors.username ??
    fieldErrors.password ??
    "Unable to sign in right now. Please try again shortly.";

  return NextResponse.json(
    {
      success: false,
      message,
      fieldErrors,
    },
    { status: 400 },
  );
}

function getLoginErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const lower = message.toLowerCase();

  if (lower.includes("account locked")) {
    return {
      message: "Account locked. Please contact an administrator.",
      status: 401,
    };
  }

  if (lower.includes("user is inactive")) {
    return {
      message: "Account inactive. Please contact support.",
      status: 401,
    };
  }

  return {
    message: "Unable to sign in right now. Please try again shortly.",
    status: 500,
  };
}

function logLoginError(error: unknown) {
  if (error && typeof error === "object") {
    const errorWithCode = error as NodeJS.ErrnoException & { hostname?: string };

    if (
      (errorWithCode.code === "ENOTFOUND" || errorWithCode.code === "ENETUNREACH") &&
      errorWithCode.hostname?.endsWith(".supabase.co")
    ) {
      console.error(
        "Login request failed: Supabase direct database host is unreachable from this machine. Use the Supavisor pooler connection string from the Supabase dashboard Connect panel instead of the direct db.<project-ref>.supabase.co host.",
        {
          code: errorWithCode.code,
          hostname: errorWithCode.hostname,
        },
      );
      return;
    }
  }

  console.error("Login request failed", error);
}

export async function POST(request: Request) {
  // UNCOMMENT WHEN MIGRATING: restore IP-based rate limiting (5 attempts / 15 min).
  // const ip = getClientIp(request);
  // try {
  //   await loginRateLimiter.consume(ip);
  // } catch {
  //   return NextResponse.json(
  //     { success: false, message: "Too many login attempts. Please try again in 15 minutes." },
  //     { status: 429, headers: { "Retry-After": "900" } },
  //   );
  // }

  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;

      return getValidationErrorResponse({
        username: fieldErrors.username?.[0] ?? "",
        password: fieldErrors.password?.[0] ?? "",
      });
    }

    const db = getPool();
    const { rows } = await db.query<{ user_id: string | null }>(
      "SELECT authenticate_user($1, $2) AS user_id",
      [parsed.data.username, parsed.data.password],
    );

    const userId = rows[0]?.user_id;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid username or password",
        },
        { status: 401 },
      );
    }

    const userResult = await db.query<UserRow>(
      `
        SELECT
          id::text AS id,
          ua.username,
          u.role::text AS role,
          u.branch_id::text AS "branchId",
          u.is_active AS "isActive"
        FROM users u
        JOIN user_auth ua ON ua.user_id = u.id
        WHERE u.id = $1
        LIMIT 1
      `,
      [userId],
    );

    const user = userResult.rows[0];

    if (!user) {
      console.error("Authenticated user was not found after login", {
        userId,
        username: parsed.data.username,
      });

      return NextResponse.json(
        {
          success: false,
          message: "Unable to sign in right now. Please try again shortly.",
        },
        { status: 500 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: "Account inactive. Please contact support.",
        },
        { status: 401 },
      );
    }

    const response = NextResponse.json({
      success: true,
      message: "Signed in successfully.",
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        branchId: user.branchId,
      },
    });

    const sessionId = crypto.randomUUID();
    const sessionResult = await createSession(response, {
      sessionId,
      userId: user.id,
      username: user.username,
      role: user.role,
      branchId: user.branchId,
    });
    const sessionTokenHash = await hashSessionToken(sessionResult.token);

    await db.query(
      `
        INSERT INTO app_sessions (
          id,
          user_id,
          session_token_hash,
          branch_id,
          expires_at
        )
        VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::timestamptz)
      `,
      [sessionId, user.id, sessionTokenHash, user.branchId, sessionResult.expiresAt.toISOString()],
    );

    return response;
  } catch (error) {
    logLoginError(error);
    const { message, status } = getLoginErrorResponse(error);

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status },
    );
  }
}

import "server-only";
import { cookies } from "next/headers";
import { getPool } from "@/lib/db/postgres";
import { SESSION_COOKIE_NAME, hashSessionToken, type SessionPayload, verifySession } from "@/lib/auth/session";

type CurrentUserRow = {
  sessionId: string;
  userId: string;
  username: string;
  role: string;
  branchId: string | null;
  branchName: string | null;
  fullName: string;
};

export type AuthenticatedUser = CurrentUserRow;

async function getSessionPayloadFromCookies() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySession(sessionToken);

  if (!session || !sessionToken) {
    return null;
  }

  return {
    session,
    sessionToken,
  };
}

async function loadCurrentUser(session: SessionPayload, sessionToken: string, touchSession: boolean) {
  const db = getPool();
  const tokenHash = await hashSessionToken(sessionToken);
  const { rows } = await db.query<CurrentUserRow>(
    `
      WITH matching_session AS (
        UPDATE app_sessions
        SET last_seen_at = CASE WHEN $3::boolean THEN now() ELSE last_seen_at END
        WHERE id = $1::uuid
          AND user_id = $2::uuid
          AND session_token_hash = $4
          AND is_revoked = false
          AND expires_at > now()
        RETURNING id, user_id
      )
      SELECT
        matching_session.id::text AS "sessionId",
        u.id::text AS "userId",
        COALESCE(ua.username, $5) AS username,
        u.role::text AS role,
        u.branch_id::text AS "branchId",
        b.name AS "branchName",
        u.full_name AS "fullName"
      FROM matching_session
      JOIN users u ON u.id = matching_session.user_id
      LEFT JOIN user_auth ua ON ua.user_id = u.id
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.is_active = true
      LIMIT 1
    `,
    [session.sessionId, session.userId, touchSession, tokenHash, session.username],
  );

  return rows[0] ?? null;
}

export async function getCurrentUser(options?: { touchSession?: boolean }) {
  const currentSession = await getSessionPayloadFromCookies();

  if (!currentSession) {
    return null;
  }

  return loadCurrentUser(currentSession.session, currentSession.sessionToken, options?.touchSession ?? false);
}

export async function revokeCurrentSession() {
  const currentSession = await getSessionPayloadFromCookies();

  if (!currentSession) {
    return;
  }

  const db = getPool();
  const tokenHash = await hashSessionToken(currentSession.sessionToken);

  await db.query(
    `
      UPDATE app_sessions
      SET is_revoked = true
      WHERE id = $1::uuid
        AND user_id = $2::uuid
        AND session_token_hash = $3
    `,
    [currentSession.session.sessionId, currentSession.session.userId, tokenHash],
  );
}

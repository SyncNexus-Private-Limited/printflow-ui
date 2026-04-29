import "server-only";
import type { AuthenticatedUser } from "@/lib/auth/current-user";
import { getPool } from "@/lib/db/postgres";
import type { CreateUserInput } from "@/lib/users/schema";

type MutationFieldErrors = Partial<Record<string, string>>;

export class UserMutationError extends Error {
  status: number;
  fieldErrors?: MutationFieldErrors;

  constructor(message: string, options?: { status?: number; fieldErrors?: MutationFieldErrors }) {
    super(message);
    this.name = "UserMutationError";
    this.status = options?.status ?? 400;
    this.fieldErrors = options?.fieldErrors;
  }
}

type CreatedUserRow = {
  id: string;
};

export async function createUser(
  currentUser: AuthenticatedUser,
  input: CreateUserInput,
): Promise<{ id: string; redirectTo: string }> {
  if (currentUser.role !== "admin") {
    throw new UserMutationError("Only administrators can create user accounts.", { status: 403 });
  }

  const db = getPool();

  // Validate branch when required by role.
  const branchId = input.branchId || null;
  if (input.role !== "admin" && !branchId) {
    throw new UserMutationError("A branch is required for this role.", {
      status: 400,
      fieldErrors: { branchId: "Select a valid, active branch." },
    });
  }

  if (branchId) {
    const { rows: branchRows } = await db.query<{ id: string }>(
      `SELECT id::text AS id FROM branches WHERE id = $1::uuid AND is_active = true LIMIT 1`,
      [branchId],
    );

    if (!branchRows[0]) {
      throw new UserMutationError("The selected branch is not available.", {
        status: 400,
        fieldErrors: { branchId: "Select a valid, active branch." },
      });
    }
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query<CreatedUserRow>(
      `
        SELECT create_user_with_auth(
          $1::uuid,         -- p_admin_id
          $2::text,         -- p_full_name
          $3::text,         -- p_phone
          $4::text,         -- p_email
          $5::text::user_role, -- p_role (dynamic)
          $6::uuid,         -- p_branch_id
          $7::text,         -- p_username
          $8::text,         -- p_password
          $9::text,         -- p_alternate_phone
          $10::text,        -- p_address
          $11::boolean      -- p_is_active
        )::text AS id
      `,
      [
        currentUser.userId,
        input.fullName,
        input.phone,
        input.email ?? null,
        input.role,
        branchId,
        input.username,
        input.password,
        input.alternatePhone ?? null,
        input.address ?? null,
        input.isActive,
      ],
    );

    await client.query("COMMIT");

    const createdId = rows[0]?.id;

    if (!createdId) {
      throw new UserMutationError("Unable to create the user account right now.", { status: 500 });
    }

    const redirectParams = new URLSearchParams({ created: "1", role: input.role });
    if (branchId) redirectParams.set("branchId", branchId);

    return {
      id: createdId,
      redirectTo: `/dashboard/users/new?${redirectParams.toString()}`,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error instanceof UserMutationError) throw error;

    const message = error instanceof Error ? error.message : "";

    if (
      message.includes("uq_user_auth_username_lower") ||
      (message.includes("duplicate key value") && message.includes("username"))
    ) {
      throw new UserMutationError("This username is already taken. Please choose another.", {
        status: 409,
        fieldErrors: { username: "This username is already taken." },
      });
    }

    if (message.includes("Only admin can create users")) {
      throw new UserMutationError("Only administrators can create user accounts.", { status: 403 });
    }

    if (message.includes("Inactive admin")) {
      throw new UserMutationError("Your account must be active to create user accounts.", {
        status: 403,
      });
    }

    console.error("User account creation failed", error);
    throw new UserMutationError("Unable to create the user account right now.", { status: 500 });
  } finally {
    client.release();
  }
}

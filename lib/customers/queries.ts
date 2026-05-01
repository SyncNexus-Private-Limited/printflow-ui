import "server-only";
import { getPool } from "@/lib/db/postgres";
import type { EditCustomerRow } from "@/lib/customers/types";

type EditCustomerDbRow = {
  id: string;
  customer_numeric_id: number | null;
  customer_code: string | null;
  type: string;
  name: string;
  phone: string;
  alternate_phone: string | null;
  address: string | null;
  studio_name: string | null;
  avatar: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  updated_by_name: string | null;
};

export async function getCustomerById(id: string): Promise<EditCustomerRow | null> {
  const db = getPool();
  const { rows } = await db.query<EditCustomerDbRow>(
    `
      SELECT
        c.id::text AS id,
        c.customer_numeric_id,
        c.customer_code,
        c.type::text AS type,
        c.name,
        c.phone,
        c.alternate_phone,
        c.address,
        c.studio_name,
        c.avatar,
        c.is_active,
        c.created_at::text AS created_at,
        c.updated_at::text AS updated_at,
        creator.full_name AS created_by_name,
        updater.full_name AS updated_by_name
      FROM customers c
      LEFT JOIN users creator ON creator.id = c.created_by
      LEFT JOIN users updater ON updater.id = c.updated_by
      WHERE c.id = $1::uuid
      LIMIT 1
    `,
    [id],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    customerNumericId: row.customer_numeric_id,
    customerCode: row.customer_code,
    type: row.type,
    name: row.name,
    phone: row.phone,
    alternatePhone: row.alternate_phone,
    address: row.address,
    studioName: row.studio_name,
    avatar: row.avatar,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByName: row.created_by_name,
    updatedByName: row.updated_by_name,
  };
}

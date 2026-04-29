import { z } from "zod";

export const branchFilterSchema = z.object({
  branchId: z.union([z.literal("all"), z.string().uuid()]).optional(),
});

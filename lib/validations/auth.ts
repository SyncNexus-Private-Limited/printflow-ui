import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(100, "Username is too long"),
  password: z.string().min(1, "Password is required").max(256, "Password is too long"),
});

export type LoginInput = z.infer<typeof loginSchema>;

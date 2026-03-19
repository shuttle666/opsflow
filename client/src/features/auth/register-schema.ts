import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long"),
  displayName: z.string().min(1, "Display name is required"),
  tenantName: z.string().trim().optional(),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;

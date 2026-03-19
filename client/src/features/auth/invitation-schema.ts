import { z } from "zod";

export const invitationCreateSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  role: z.enum(["MANAGER", "STAFF"]),
});

export type InvitationCreateFormValues = z.infer<typeof invitationCreateSchema>;

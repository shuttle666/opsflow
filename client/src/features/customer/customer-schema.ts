import { z } from "zod";

export const customerFormSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required"),
  phone: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "Enter a valid email",
    }),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;
